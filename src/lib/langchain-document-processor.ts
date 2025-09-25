import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storeMemory } from './mem0';
import { logLLMRequest } from './keywords-ai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import fetch from 'node-fetch';

// Initialize Gemini (mandatory AI framework)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!);

export interface ProcessedDocumentResult {
  content: string;
  chunks: Document[];
  metadata: {
    type: string;
    fileName?: string;
    fileType?: string;
    chunkCount: number;
    wordCount: number;
    processingMethod: string;
    error?: string;
  };
  summary?: string;
}

// Helper function to extract PDF content with fallback methods
const extractPDFContent = async (url: string, fileName: string): Promise<{ content: string; method: string }> => {
  try {
    console.log('🔄 Starting enhanced PDF extraction from URL:', url);
    
    // Fetch the PDF file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('📄 Downloaded PDF buffer, size:', buffer.length, 'bytes');
    
    // Use the enhanced PDF extractor
    const { extractPDFContent } = await import('@/lib/pdf-extractor');
    const result = await extractPDFContent(buffer, fileName);
    
    if (result.success) {
      console.log('✅ Enhanced PDF extraction successful:', {
        method: result.metadata.method,
        contentLength: result.content.length,
        wordCount: result.metadata.wordCount,
        pages: result.metadata.pages,
        processingTime: result.metadata.processingTime
      });
      
      return {
        content: result.content,
        method: `enhanced-${result.metadata.method}`
      };
    } else {
      console.log('⚠️ Enhanced PDF extraction failed, using fallback content:', {
        method: result.metadata.method,
        error: result.metadata.error,
        warnings: result.metadata.warnings
      });
      
      // Return the detailed fallback content
      return {
        content: result.content, // Contains detailed error explanation
        method: `enhanced-${result.metadata.method}-fallback`
      };
    }
  } catch (error) {
    console.error('❌ Enhanced PDF extraction failed completely:', error);
    
    // Final fallback
    return {
      content: `PDF Document: ${fileName}

Enhanced PDF Extraction Failed

The PDF file could not be processed using the enhanced extraction system.

Error: ${error instanceof Error ? error.message : 'Unknown error'}

This document was detected as a PDF but text extraction is not available.`,
      method: 'enhanced-error-fallback'
    };
  }
};

// Enhanced file content processor using Langchain loaders
export const processDocumentWithLangchain = async (
  url: string,
  fileName: string,
  fileType: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    generateSummary?: boolean;
    userId?: string;
    itemId?: string;
  } = {}
): Promise<ProcessedDocumentResult> => {
  const { 
    chunkSize = 1000, 
    chunkOverlap = 200, 
    generateSummary = true,
    userId,
    itemId 
  } = options;
  
  console.log(`🔄 Processing document: ${fileName} (${fileType})`);
  
  try {
    let documents: Document[] = [];
    let processingMethod = 'unknown';
    let extractedContent = '';
    
    // Determine file type and use appropriate langchain loader
    const fileExt = fileName?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType === 'application/pdf' || fileExt === 'pdf') {
      // Enhanced PDF processing with fallbacks
      const pdfResult = await extractPDFContent(url, fileName);
      extractedContent = pdfResult.content;
      processingMethod = pdfResult.method;
      
      documents = [new Document({
        pageContent: extractedContent,
        metadata: { 
          source: url, 
          fileName, 
          fileType,
          loader: processingMethod 
        }
      })];
      
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileExt === 'docx'
    ) {
      // DOCX processing with langchain and fallback
      console.log('📝 Processing Word document...');
      try {
        console.log('🔄 Method 1: Langchain DocxLoader');
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const loader = new DocxLoader(blob);
        documents = await loader.load();
        processingMethod = 'langchain_docx';
        
        if (!documents || documents.length === 0 || !documents[0].pageContent.trim()) {
          throw new Error('Langchain DocxLoader returned empty content');
        }
        console.log('✅ Langchain DocxLoader succeeded');
      } catch (docxError) {
        console.log('⚠️ Langchain DocxLoader failed, trying mammoth fallback...');
        try {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
          extractedContent = result.value || '';
          
          documents = [new Document({
            pageContent: extractedContent,
            metadata: { 
              source: url, 
              fileName, 
              fileType,
              loader: 'mammoth_fallback' 
            }
          })];
          processingMethod = 'mammoth_fallback';
          console.log('✅ Mammoth fallback succeeded');
        } catch (mammothError) {
          console.error('❌ Both DOCX methods failed:', mammothError);
          throw new Error('Failed to extract content from Word document');
        }
      }
      
    } else if (fileType === 'text/csv' || fileExt === 'csv') {
      // CSV processing with langchain
      console.log('📊 Using Langchain CSVLoader');
      const response = await fetch(url);
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const loader = new CSVLoader(blob);
      documents = await loader.load();
      processingMethod = 'langchain_csv';
      
    } else if (
      fileType?.startsWith('text/') || 
      ['txt', 'md', 'json', 'xml', 'log', 'js', 'ts', 'py', 'html', 'css'].includes(fileExt)
    ) {
      // Text file processing
      console.log('📄 Using direct text processing');
      const response = await fetch(url);
      const text = await response.text();
      documents = [new Document({
        pageContent: text,
        metadata: { 
          source: url, 
          fileName, 
          fileType,
          loader: 'direct_text' 
        }
      })];
      processingMethod = 'direct_text';
      
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      fileType === 'application/vnd.ms-excel' || 
      ['xlsx', 'xls'].includes(fileExt)
    ) {
      // Excel processing with fallback
      console.log('📊 Processing Excel file...');
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        let content = '';
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_csv(sheet);
          content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
        });
        
        documents = [new Document({
          pageContent: content,
          metadata: { 
            source: url, 
            fileName, 
            fileType,
            loader: 'xlsx_processor' 
          }
        })];
        processingMethod = 'xlsx_processor';
        console.log('✅ Excel processing succeeded');
      } catch (excelError) {
        console.error('❌ Excel processing failed:', excelError);
        throw new Error('Failed to extract content from Excel file');
      }
      
    } else {
      // Fallback: try to process as text
      console.log('⚠️ Using fallback text processing');
      const response = await fetch(url);
      const text = await response.text();
      documents = [new Document({
        pageContent: text.substring(0, 10000), // Limit fallback content
        metadata: { 
          source: url, 
          fileName, 
          fileType,
          loader: 'fallback' 
        }
      })];
      processingMethod = 'fallback_text';
    }
    
    // Validate that we have content
    if (!documents || documents.length === 0) {
      throw new Error('No documents were created from the file');
    }
    
    const fullContent = documents.map(doc => doc.pageContent).join('\n\n');
    if (!fullContent.trim()) {
      throw new Error('Documents were created but contain no text content');
    }
    
    console.log(`✅ Loaded ${documents.length} document(s) using ${processingMethod}`);
    
    // Enhanced text splitting using langchain (as per template)
    const textSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize,
      chunkOverlap,
    });
    
    // Split documents into chunks
    const splitDocuments = await textSplitter.splitDocuments(documents);
    console.log(`🔪 Split into ${splitDocuments.length} chunks`);
    
    // Combine all content for analysis
    const wordCount = fullContent.split(/\s+/).filter(word => word.length > 0).length;
    
    // Enhanced metadata
    const enhancedMetadata = {
      type: 'processed',
      fileName,
      fileType,
      chunkCount: splitDocuments.length,
      wordCount,
      processingMethod,
      extractedAt: new Date().toISOString(),
      contentLength: fullContent.length
    };
    
    // Add enhanced metadata to each chunk
    const enhancedChunks = splitDocuments.map(chunk => {
      return new Document({
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          ...enhancedMetadata,
          chunkIndex: splitDocuments.indexOf(chunk)
        }
      });
    });
    
    const result: ProcessedDocumentResult = {
      content: fullContent,
      chunks: enhancedChunks,
      metadata: enhancedMetadata
    };
    
    // Generate AI summary using Gemini (mandatory AI framework)
    if (generateSummary && fullContent.trim()) {
      console.log('🤖 Generating AI summary with Gemini...');
      try {
        const summary = await generateDocumentSummary(fullContent, enhancedMetadata, userId, itemId);
        result.summary = summary;
      } catch (summaryError) {
        console.error('⚠️ Summary generation failed:', summaryError);
        result.summary = `Summary generation failed: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`;
      }
    }
    
    // Store in memory for context-aware responses (Mem0 integration)
    if (userId && itemId) {
      try {
        await storeMemory(userId, [
          {
            role: 'assistant',
            content: [{
              type: 'text',
              text: `Processed document "${fileName}" (${fileType}): ${splitDocuments.length} chunks, ${wordCount} words. Method: ${processingMethod}`
            }]
          }
        ], {
          itemId,
          type: 'document_processing',
          processingMethod,
          chunkCount: splitDocuments.length
        });
      } catch (memoryError) {
        console.error('⚠️ Memory storage failed:', memoryError);
      }
    }
    
    console.log(`🎉 Document processing complete: ${splitDocuments.length} chunks, ${wordCount} words`);
    return result;
    
  } catch (error) {
    console.error('💥 Document processing failed:', error);
    
    // Return error result with more helpful information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: `Error processing document "${fileName}": ${errorMessage}

This could be due to:
- File corruption or invalid format
- Unsupported file encoding
- Network issues downloading the file
- File is password protected or encrypted
- File contains only images without extractable text

Please try uploading the file again or ensure it contains extractable text content.`,
      chunks: [],
      metadata: {
        type: 'error',
        fileName,
        fileType,
        chunkCount: 0,
        wordCount: 0,
        processingMethod: 'failed',
        error: errorMessage
      }
    };
  }
};

// Web content processing using Langchain web loader
export const processWebContentWithLangchain = async (
  url: string,
  options: {
    generateSummary?: boolean;
    userId?: string;
    itemId?: string;
  } = {}
): Promise<ProcessedDocumentResult> => {
  const { generateSummary = true, userId, itemId } = options;
  
  console.log(`🌐 Processing web content: ${url}`);
  
  try {
    // Use Langchain CheerioWebBaseLoader for web content (as per template)
    const loader = new CheerioWebBaseLoader(url);
    const documents = await loader.load();
    
    if (!documents || documents.length === 0) {
      throw new Error('No content could be extracted from the web page');
    }
    
    console.log(`✅ Loaded web content: ${documents.length} document(s)`);
    
    // Text splitting
    const textSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const splitDocuments = await textSplitter.splitDocuments(documents);
    const fullContent = documents.map(doc => doc.pageContent).join('\n\n');
    const wordCount = fullContent.split(/\s+/).filter(word => word.length > 0).length;
    
    const metadata = {
      type: 'web_processed',
      fileName: url,
      fileType: 'text/html',
      chunkCount: splitDocuments.length,
      wordCount,
      processingMethod: 'langchain_web'
    };
    
    const result: ProcessedDocumentResult = {
      content: fullContent,
      chunks: splitDocuments,
      metadata
    };
    
    // Generate summary if requested
    if (generateSummary && fullContent.trim()) {
      console.log('🤖 Generating web content summary...');
      try {
        const summary = await generateDocumentSummary(fullContent, metadata, userId, itemId);
        result.summary = summary;
      } catch (summaryError) {
        console.error('⚠️ Web summary generation failed:', summaryError);
        result.summary = `Summary generation failed: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`;
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('💥 Web content processing failed:', error);
    return {
      content: `Error processing web content from "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      chunks: [],
      metadata: {
        type: 'web_error',
        fileName: url,
        fileType: 'text/html',
        chunkCount: 0,
        wordCount: 0,
        processingMethod: 'failed'
      }
    };
  }
};

// Generate AI summary using Gemini (mandatory AI framework)
const generateDocumentSummary = async (
  content: string,
  metadata: any,
  userId?: string,
  itemId?: string
): Promise<string> => {
  const startTime = Date.now();
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const prompt = `Please provide a comprehensive and well-structured summary of the following document content. Focus on key points, main ideas, and important details.

Document: ${metadata.fileName || 'Unknown'}
Type: ${metadata.fileType || 'Unknown'}
Processing Method: ${metadata.processingMethod || 'Unknown'}
Word Count: ${metadata.wordCount || 0}

Content to summarize:
${content.substring(0, 15000)}${content.length > 15000 ? '...[content truncated for processing]' : ''}

Please create a clear, informative summary that captures the essence of this content:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text() || 'Unable to generate summary.';
    
    // Log to Keywords AI (mandatory monitoring framework)
    if (userId) {
      try {
        await logLLMRequest({
          model: 'gemini-2.0-flash-exp',
          prompt: prompt.substring(0, 500) + '...',
          response: summary,
          userId,
          metadata: {
            itemId,
            contentType: metadata.type,
            responseTime: Date.now() - startTime,
            provider: 'google-gemini',
            feature: 'langchain_document_summary',
            processingMethod: metadata.processingMethod,
            wordCount: metadata.wordCount
          }
        });
      } catch (loggingError) {
        console.error('⚠️ Keywords AI logging failed:', loggingError);
      }
    }
    
    return summary;
    
  } catch (error) {
    console.error('💥 Gemini summary generation failed:', error);
    throw error;
  }
}; 