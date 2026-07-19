import crypto from "crypto";
import JSZip from "jszip";
import * as mammoth from "mammoth";
import { executeSingle } from "@/lib/tidb";

function chunks(content: string, size = 2200, overlap = 200) {
  const result: string[] = [];
  for (let start = 0; start < content.length; start += size - overlap) result.push(content.slice(start, start + size));
  return result;
}

export async function extractClassroomFile(file: { name: string; type: string }, buffer: Buffer, transcribe?: (buffer: Buffer, file: { name: string; type: string }) => Promise<string>) {
  if (file.type === "text/plain" || file.type === "text/csv") return buffer.toString("utf8");
  if (file.type.includes("wordprocessingml") || file.type === "application/msword") return (await mammoth.extractRawText({ buffer })).value;
  if (file.type === "application/pdf") {
    const { processPDFAdvanced } = await import("@/lib/advanced-pdf-processor");
    const result = await processPDFAdvanced(buffer, file.name);
    if (!result.success) throw new Error("PDF extraction failed");
    return result.content;
  }
  if (file.type.includes("presentationml") || file.type === "application/vnd.ms-powerpoint") {
    if (!file.name.toLowerCase().endsWith(".pptx")) throw new Error("Legacy .ppt files require conversion to .pptx");
    const archive = await JSZip.loadAsync(buffer);
    const names = Object.keys(archive.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    const slides = await Promise.all(names.map(async (name, index) => {
      const xml = await archive.file(name)!.async("text");
      const text = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((match) => match[1]).join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      return `Slide ${index + 1}\n${text}`;
    }));
    const imageNames = Object.keys(archive.files).filter((name) => /^ppt\/media\/.*\.(png|jpe?g|webp|bmp|tiff?)$/i.test(name)).slice(0, 30);
    const imageText: string[] = [];
    if (imageNames.length) {
      const Tesseract = await import("tesseract.js");
      for (let index = 0; index < imageNames.length; index += 1) {
        const image = await archive.file(imageNames[index])!.async("nodebuffer");
        if (image.length > 5 * 1024 * 1024) continue;
        const text = (await Tesseract.recognize(image, "eng")).data.text.trim();
        if (text) imageText.push(`Embedded presentation image ${index + 1}\n${text}`);
      }
    }
    return [...slides, ...imageText].join("\n\n");
  }
  if (file.type.startsWith("image/")) {
    const Tesseract = await import("tesseract.js");
    return (await Tesseract.recognize(buffer, "eng")).data.text;
  }
  if (file.type.includes("spreadsheet")) {
    const { excelSheetsToText, readExcelWorkbook } = await import("@/lib/excel-processor");
    return excelSheetsToText(await readExcelWorkbook(buffer));
  }
  if (file.type === "application/vnd.ms-excel") {
    throw new Error("Legacy .xls files must be converted to .xlsx before upload");
  }
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    if (!transcribe) throw new Error("Media transcription is not configured");
    return transcribe(buffer, file);
  }
  return "";
}

export async function createPendingKnowledgeDocument(userId: string, file: { name: string; type: string }, target: { type: "workspace" | "assignment" | "submission"; id: string }, sourceAttachmentId: string) {
  const documentId = crypto.randomUUID();
  await executeSingle(
    `INSERT INTO knowledge_documents (id, user_id, scope_type, scope_id, source_item_id, file_name, mime_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [documentId, userId, target.type, target.id, sourceAttachmentId, file.name, file.type]
  );
  return documentId;
}

export async function ingestStoredClassroomFile(documentId: string, file: { name: string; type: string }, buffer: Buffer, options?: {
  transcribe?: (buffer: Buffer, file: { name: string; type: string }) => Promise<string>;
  embed?: (texts: string[]) => Promise<{ vectors: number[][]; model: string }>;
  throwOnFailure?: boolean;
}) {
  const claimed = await executeSingle(
    `UPDATE knowledge_documents SET status='processing', error_message=NULL, attempt_count=attempt_count+1 WHERE id=? AND status IN ('pending','failed')`,
    [documentId]
  );
  if (claimed.affectedRows === 0) return documentId;
  try {
    const content = (await extractClassroomFile(file, buffer, options?.transcribe)).trim();
    if (!content) throw new Error("No readable content was extracted");
    const extractedChunks = chunks(content);
    let embeddings: number[][] = [];
    let embeddingModel: string | null = null;
    if (options?.embed) {
      try {
        for (let start = 0; start < extractedChunks.length; start += 16) {
          const result = await options.embed(extractedChunks.slice(start, start + 16));
          embeddings.push(...result.vectors);
          embeddingModel = result.model;
        }
        if (embeddings.length !== extractedChunks.length) throw new Error("Embedding count did not match chunk count");
      } catch (error) {
        embeddings = [];
        await executeSingle(
          `UPDATE knowledge_documents SET embedding_status='failed', error_message=? WHERE id=?`,
          [error instanceof Error ? `Embedding failed: ${error.message}`.slice(0, 2000) : "Embedding failed", documentId],
        );
      }
    }
    for (let index = 0; index < extractedChunks.length; index += 1) {
      await executeSingle(
        `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, locator, embedding_vector) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), documentId, index, extractedChunks[index], JSON.stringify({ fileName: file.name, chunk: index + 1 }), embeddings[index] ? JSON.stringify(embeddings[index]) : null],
      );
    }
    await executeSingle(
      `UPDATE knowledge_documents SET status='ready', embedding_status=?, embedding_model=?, processed_at=UTC_TIMESTAMP() WHERE id=?`,
      [embeddings.length ? "ready" : options?.embed ? "failed" : "disabled", embeddingModel, documentId],
    );
  } catch (error) {
    await executeSingle(`UPDATE knowledge_documents SET status = 'failed', error_message = ? WHERE id = ?`, [error instanceof Error ? error.message.slice(0, 2000) : "Extraction failed", documentId]);
    if (options?.throwOnFailure) throw error;
  }
  return documentId;
}

export async function ingestClassroomFile(userId: string, file: File, target: { type: "assignment" | "submission"; id: string }, sourceAttachmentId = crypto.randomUUID()) {
  const documentId = await createPendingKnowledgeDocument(userId, file, target, sourceAttachmentId);
  return ingestStoredClassroomFile(documentId, file, Buffer.from(await file.arrayBuffer()));
}
