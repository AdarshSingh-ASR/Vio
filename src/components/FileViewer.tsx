import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';



interface FileViewerProps {
  url: string;
  fileType?: string;
  fileName?: string;
}

const getExt = (name: string = '') => name.split('.').pop()?.toLowerCase() || '';

// IMPORTANT: When uploading to Cloudinary, always include the .pdf extension in the public ID or file name for PDFs.
function getCloudinaryInlineUrl(url: string) {
  if (!url.includes('/raw/upload/')) return url;
  return url.replace('/raw/upload/', '/raw/upload/fl_inline/');
}

// Helper to get a Cloudinary image URL for a PDF preview (first page as PNG)
function getCloudinaryPdfAsImageUrl(url: string, page: number = 1, options: string = ''): string {
  if (!url.includes('/raw/upload/')) return url;
  let imageUrl = url.replace('/raw/upload/', '/image/upload/');
  imageUrl = imageUrl.replace(/\.pdf$/, '.png');
  const insert: string[] = [];
  if (page > 1) insert.push(`pg_${page}`);
  if (options) insert.push(options);
  if (insert.length) {
    imageUrl = imageUrl.replace('/image/upload/', `/image/upload/${insert.join(',')}/`);
  }
  return imageUrl;
}

const FileViewer: React.FC<FileViewerProps> = ({ url, fileType, fileName }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [excelTable, setExcelTable] = useState<React.ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ext = getExt(fileName);

  useEffect(() => {
    let revoked = false;
    setBlobUrl(null);
    setTextContent(null);
    setDocxHtml(null);
    setExcelTable(null);
    setError(null);

    // DOCX (Word)
    if ((ext === 'docx' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      fetch(url)
        .then(async res => {
          if (!res.ok) throw new Error('Failed to fetch file');
          const arrayBuffer = await res.arrayBuffer();
          try {
            const mammoth = await import('mammoth');
            const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
            if (!revoked) setDocxHtml(html);
          } catch (e) {
            if (!revoked) setDocxHtml(null);
          }
        })
        .catch(() => setError('Could not load Word document.'));
      return () => { revoked = true; };
    }

    // XLSX/XLS (Excel)
    if (['xlsx', 'xls'].includes(ext) || fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      fetch(url)
        .then(async res => {
          if (!res.ok) throw new Error('Failed to fetch file');
          const arrayBuffer = await res.arrayBuffer();
          try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (!revoked) setExcelTable(
              <div className="overflow-auto max-h-96">
                <table className="min-w-full border text-xs">
                  <tbody>
                    {(data as any[][]).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="border px-2 py-1">{cell !== undefined ? String(cell) : ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          } catch (e) {
            if (!revoked) setExcelTable(null);
          }
        })
        .catch(() => setError('Could not load Excel file.'));
      return () => { revoked = true; };
    }

    // Text
    if ((fileType?.startsWith('text') || ['txt', 'json', 'csv', 'md'].includes(ext))) {
      fetch(url)
        .then(async res => {
          if (!res.ok) throw new Error('Failed to fetch file');
          const text = await res.text();
          if (!revoked) setTextContent(text);
        })
        .catch(() => setError('Could not load file.'));
      return () => { revoked = true; };
    }

    // Everything else
    fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error('Failed to fetch file');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (!revoked) setBlobUrl(blobUrl);
      })
      .catch(() => setError('Could not load file.'));
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line
  }, [url, fileType, fileName]);

  if (error) return <div className="text-red-500">{error}</div>;
  if (docxHtml !== null) {
    if (docxHtml) {
      return <div className="prose max-w-none bg-gray-50 rounded p-2 overflow-auto max-h-96" dangerouslySetInnerHTML={{ __html: docxHtml }} />;
    } else {
      const gdocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
      return <iframe src={gdocsUrl} title="Word Viewer" width="100%" height={500} className="rounded border" />;
    }
  }
  if (excelTable !== null) {
    if (excelTable) return excelTable;
    const gdocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    return <iframe src={gdocsUrl} title="Excel Viewer" width="100%" height={500} className="rounded border" />;
  }
  // PDF: Use iframe for viewing
  if (fileType === 'application/pdf' || ext === 'pdf') {
    const inlineUrl = getCloudinaryInlineUrl(url);
    return (
      <iframe
        src={inlineUrl}
        className="w-full h-full"
        style={{ border: 'none', minHeight: 400 }}
        title="PDF Viewer"
      />
    );
  }
  if (textContent !== null) {
    return (
      <pre className="bg-gray-100 rounded p-2 overflow-auto max-h-96 whitespace-pre-wrap text-sm">{textContent}</pre>
    );
  }
  if (!blobUrl && !textContent && !docxHtml && !excelTable) return <div>Loading file...</div>;
  // Image
  if (fileType?.startsWith('image') && blobUrl) {
    return <img src={blobUrl} alt={fileName || 'image'} className="rounded max-h-96 w-auto mx-auto" />;
  }
  // Video
  if (fileType?.startsWith('video') && blobUrl) {
    return <video src={blobUrl} controls className="rounded max-h-96 w-full" />;
  }
  // Audio
  if (fileType?.startsWith('audio') && blobUrl) {
    return <audio src={blobUrl} controls className="w-full" />;
  }
  // Office docs (doc, ppt, pptx) - fallback to Google Docs Viewer
  if ((['doc', 'ppt', 'pptx'].includes(ext)) && blobUrl) {
    const gdocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    return (
      <iframe src={gdocsUrl} title="Office Viewer" width="100%" height={500} className="rounded border" />
    );
  }
  // Fallback
  return (
    <div className="text-center text-gray-500">
      Cannot preview this file type.<br />
      <a href={blobUrl || url} download={fileName} className="text-primary underline">Download file</a>
    </div>
  );
};

export default FileViewer; 