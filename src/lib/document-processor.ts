import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ProcessedDocument {
  content: string;
  metadata: {
    type: string;
    fileName?: string;
    fileType?: string;
    chunks?: number;
    wordCount?: number;
  };
  chunks: Document[];
}

// Helper function to fetch file content as buffer
const fetchFileBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

// Extract raw text from different file types
const extractRawText = async (url: string, fileName: string, fileType: string): Promise<string> => {
  const fileExt = fileName?.split('.').pop()?.toLowerCase() || '';
  
  try {
    const buffer = await fetchFileBuffer(url);
    
    // PDF files - use enhanced extractor
    if (fileType === 'application/pdf' || fileExt === 'pdf') {
      console.log('📄 Using enhanced PDF extractor for', fileName);
      const { extractPDFContent } = await import('@/lib/pdf-extractor');
      const result = await extractPDFContent(buffer, fileName);
      
      if (result.success) {
        console.log('✅ Enhanced PDF extraction successful:', {
          method: result.metadata.method,
          wordCount: result.metadata.wordCount,
          pages: result.metadata.pages
        });
        return result.content;
      } else {
        // Return the fallback content which includes detailed error information
        console.log('⚠️ Enhanced PDF extraction failed, using fallback content');
        return result.content; // This contains the detailed fallback explanation
      }
    }
    
    // Word documents
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword' || 
        ['docx', 'doc'].includes(fileExt)) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    
    // Excel files
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        fileType === 'application/vnd.ms-excel' || 
        ['xlsx', 'xls'].includes(fileExt)) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let content = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_csv(sheet);
        content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
      });
      return content;
    }
    
    // Text files (including code files)
    if (fileType?.startsWith('text/') || 
        ['txt', 'md', 'csv', 'json', 'xml', 'log', 'js', 'ts', 'py', 'html', 'css'].includes(fileExt)) {
      return buffer.toString('utf-8');
    }
    
    // Default: try to read as text
    try {
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
    
  } catch (error) {
    console.error(`Error extracting content from ${fileName}:`, error);
    throw new Error(`Failed to extract content from ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Process document using langchain approach
export const processDocument = async (
  url: string, 
  fileName: string, 
  fileType: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    maxChunks?: number;
  } = {}
): Promise<ProcessedDocument> => {
  const { chunkSize = 1000, chunkOverlap = 200, maxChunks = 10 } = options;
  
  try {
    // Extract raw text
    const rawText = await extractRawText(url, fileName, fileType);
    
    if (!rawText.trim()) {
      return {
        content: `File: ${fileName}\nType: ${fileType}\nNote: No text content could be extracted from this file.`,
        metadata: {
          type: 'metadata_only',
          fileName,
          fileType,
          chunks: 0,
          wordCount: 0
        },
        chunks: []
      };
    }
    
    // Use langchain text splitter for intelligent chunking
    const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize,
      chunkOverlap,
    });
    
    // Create documents with metadata
    const documents = await splitter.createDocuments([rawText], [{
      fileName,
      fileType,
      url,
      extractedAt: new Date().toISOString()
    }]);
    
    // Limit chunks if specified
    const limitedDocuments = maxChunks > 0 ? documents.slice(0, maxChunks) : documents;
    
    const wordCount = rawText.split(/\s+/).filter(word => word.length > 0).length;
    
    return {
      content: rawText,
      metadata: {
        type: 'processed',
        fileName,
        fileType,
        chunks: limitedDocuments.length,
        wordCount
      },
      chunks: limitedDocuments
    };
    
  } catch (error) {
    console.error('Document processing error:', error);
    
    return {
      content: `File: ${fileName}\nType: ${fileType}\nError: ${error instanceof Error ? error.message : 'Failed to process document'}`,
      metadata: {
        type: 'error',
        fileName,
        fileType,
        chunks: 0,
        wordCount: 0
      },
      chunks: []
    };
  }
};

// Create summary from processed document
export const createDocumentSummary = (processedDoc: ProcessedDocument): string => {
  const { content, metadata } = processedDoc;
  
  if (metadata.type === 'error') {
    return content;
  }
  
  if (metadata.type === 'metadata_only') {
    return content;
  }
  
  // For processed documents, return the first chunk or full content (truncated)
  const summaryContent = content.length > 3000 ? 
    content.substring(0, 3000) + '...[content truncated]' : 
    content;
    
  return `Document: ${metadata.fileName}
Type: ${metadata.fileType}
Word Count: ${metadata.wordCount}
Processed Chunks: ${metadata.chunks}

Content Preview:
${summaryContent}`;
};

// Extract web content using simple fetch (fallback for Tavily)
export const extractWebContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Simple HTML text extraction (remove tags)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 5000); // Limit content length
    
  } catch (error) {
    console.error('Web content extraction error:', error);
    throw new Error(`Failed to extract web content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 