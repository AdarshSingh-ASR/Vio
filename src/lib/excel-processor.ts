import JSZip from "jszip";

export type ExcelSheet = { name: string; rows: string[][] };

const decodeXml = (value: string) => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&");

const textNodes = (xml: string) => Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((match) => decodeXml(match[1])).join("");

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

export async function readExcelWorkbook(input: ArrayBuffer | Uint8Array): Promise<ExcelSheet[]> {
  const archive = await JSZip.loadAsync(input);
  const workbookXml = await archive.file("xl/workbook.xml")?.async("text");
  const relationshipsXml = await archive.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !relationshipsXml) throw new Error("The XLSX workbook structure is invalid");

  const sharedXml = await archive.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedXml ? Array.from(sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)).map((match) => textNodes(match[1])) : [];
  const relationships = new Map(Array.from(relationshipsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?\s*>/g)).map((match) => [match[1], match[2]]));
  const sheetDefinitions = Array.from(workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*(?:r:id|id)="([^"]+)"[^>]*\/?\s*>/g));

  const sheets: ExcelSheet[] = [];
  for (const definition of sheetDefinitions) {
    const target = relationships.get(definition[2]);
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
    const worksheetXml = await archive.file(path)?.async("text");
    if (!worksheetXml) continue;
    const rows = Array.from(worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)).map((rowMatch) => {
      const row: string[] = [];
      for (const cellMatch of Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))) {
        const attributes = cellMatch[1];
        const body = cellMatch[2];
        const reference = attributes.match(/\br="([^"]+)"/)?.[1] || "A1";
        const type = attributes.match(/\bt="([^"]+)"/)?.[1];
        const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
        const value = type === "s" ? sharedStrings[Number(rawValue)] || "" : type === "inlineStr" ? textNodes(body) : decodeXml(rawValue);
        row[columnIndex(reference)] = value;
      }
      return Array.from({ length: row.length }, (_, index) => row[index] || "");
    });
    sheets.push({ name: decodeXml(definition[1]), rows });
  }
  if (!sheets.length) throw new Error("The XLSX workbook contains no readable worksheets");
  return sheets;
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function excelSheetsToText(sheets: ExcelSheet[]) {
  return sheets.map((sheet) => `Sheet: ${sheet.name}\n${sheet.rows.map((row) => row.map(csvCell).join(",")).join("\n")}`).join("\n\n");
}
