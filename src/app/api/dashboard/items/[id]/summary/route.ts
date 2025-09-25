import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as mammoth from 'mammoth';
import { dashboardItemService, userService } from '@/lib/tidb-service';

// Initialize Gemini (mandatory AI framework)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!);

// Helper function to extract file ID from Appwrite URL
function extractFileId(url: string): string {
  try {
    console.log('🔍 Extracting file ID from URL:', url);
    
    // Handle different Appwrite URL patterns
    const urlParts = url.split('/');
    console.log('🔍 URL parts for file ID extraction:', urlParts);
    
    // Pattern 1: .../buckets/files/files/FILE_ID/view?...
    const bucketsIndex = urlParts.findIndex(part => part === 'buckets');
    if (bucketsIndex !== -1 && 
        urlParts[bucketsIndex + 1] === 'files' && 
        urlParts[bucketsIndex + 2] === 'files' && 
        urlParts[bucketsIndex + 3]) {
      const fileIdPart = urlParts[bucketsIndex + 3];
      // Remove any query parameters
      const cleanFileId = fileIdPart.split('?')[0];
      console.log('🎯 Extracted file ID (pattern 1):', cleanFileId);
      return cleanFileId;
    }
    
    // Pattern 2: Direct file ID patterns (try other common patterns)
    // Look for a pattern that looks like a file ID (alphanumeric, certain length)
    for (let i = 0; i < urlParts.length; i++) {
      const part = urlParts[i];
      // Appwrite file IDs are typically 20+ characters alphanumeric
      if (part && part.length >= 20 && /^[a-zA-Z0-9]+$/.test(part.split('?')[0])) {
        const cleanFileId = part.split('?')[0];
        console.log('🎯 Extracted file ID (pattern 2):', cleanFileId);
        return cleanFileId;
      }
    }
    
    console.error('❌ Could not extract file ID from URL pattern:', url);
    throw new Error(`Could not extract file ID from URL: ${url}`);
  } catch (error) {
    console.error('❌ Error in extractFileId:', error);
    throw new Error(`Failed to extract file ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log('🚀 SUMMARY ENDPOINT HIT! Raw params:', params);
  console.log('🚀 Request URL:', req.url);
  
  try {
    // Get authenticated services with JWT
    const { databases, user, storage } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const itemId = params.id;
    
    console.log('📝 Summary request for itemId:', itemId, 'userId:', userId);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(userId);
    if (!dbUser) {
      console.log('🚫 User not found in TiDB database');
      return NextResponse.json({ 
        summary: 'User not found in database.' 
      }, { status: 404 });
    }
    
    // Get the item from TiDB database
    const item = await dashboardItemService.getById(itemId);
    if (!item) {
      console.log('🚫 Item not found in TiDB database');
      return NextResponse.json({ 
        summary: 'Item not found in database.' 
      }, { status: 404 });
    }
    
    console.log('✅ Found item:', item.title, 'Type:', item.fileType);
    
    // Verify ownership
    if (item.createdBy !== dbUser.id) {
      console.log('🚫 Permission denied - item createdBy:', item.createdBy, 'current userId:', dbUser.id);
      return NextResponse.json({ 
        summary: 'Permission denied - you do not have access to this item.' 
      }, { status: 403 });
    }

    console.log('📄 Processing item:', item.title, 'Type:', item.fileType);
    console.log('📂 Item details:', {
      name: item.title,
      type: item.fileType,
      fileType: item.fileType,
      contentType: item.fileType,
      url: item.fileUrl ? 'Present' : 'Missing',
      hasContent: item.content ? 'Present' : 'Missing',
      hasExtractedContent: item.content ? 'Present' : 'Missing',
      extractedContentLength: item.content ? item.content.length : 0,
      fileSize: item.fileSize
    });

    // Extract content based on what's available
    let extractedContent = '';
    let processingDetails = '';
    let contentType = item.fileType;

    // First, check if we already have extracted content
    if (item.content && item.content.length > 0) {
      extractedContent = item.content;
      processingDetails = `Using content from database`;
      contentType = item.fileType;
      
      console.log('✅ Using content from database:', {
        type: item.fileType,
        length: extractedContent.length,
        wordCount: extractedContent.split(/\s+/).length
      });
    } 
    // Fallback to file content extraction for uploaded files
    else if (item.fileType !== 'link' && item.fileUrl) {
      const fileType = item.fileType || '';
      const fileName = item.title || 'unknown';
      
      if (fileType.includes('word') || fileType.includes('document') || fileName.endsWith('.docx')) {
        // Parse DOCX with mammoth
        contentType = 'Word document';
        console.log('📝 Parsing DOCX with mammoth...');
        
        try {
          // Extract file ID from URL
          const fileId = extractFileId(item.fileUrl);
          console.log('📂 File ID extracted:', fileId);
          
          // Download file content
          const fileBuffer = await storage.getFileDownload('files', fileId);
          const uint8Array = new Uint8Array(fileBuffer);
          const buffer = Buffer.from(uint8Array);
          
          // Extract text using mammoth
          const result = await mammoth.extractRawText({ buffer: buffer });
          extractedContent = result.value;
          processingDetails = `DOCX parsing: ${extractedContent.length} characters extracted`;
          console.log('✅ DOCX parsed successfully:', processingDetails);
          
        } catch (docxError) {
          console.error('❌ DOCX parsing failed:', docxError);
          extractedContent = `DOCX parsing failed: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`;
          processingDetails = 'DOCX parsing error';
        }
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // Parse PDF
        contentType = 'PDF document';
        console.log('📄 Parsing PDF...');
        
        try {
          // Extract file ID from URL
          const fileId = extractFileId(item.fileUrl);
          console.log('📂 File ID extracted:', fileId);
          
          // Download file content
          const fileBuffer = await storage.getFileDownload('files', fileId);
          const uint8Array = new Uint8Array(fileBuffer);
          const buffer = Buffer.from(uint8Array);
          
          console.log('📄 Downloaded PDF buffer size:', buffer.length, 'bytes');
          
          // Use the advanced PDF processor with type detection and OCR fallback
          const { processPDFAdvanced } = await import('@/lib/advanced-pdf-processor');
          const result = await processPDFAdvanced(buffer, fileName);
          
          if (result.success) {
            extractedContent = result.content;
            processingDetails = `Advanced PDF extraction successful: ${result.method} - ${result.content.length} characters extracted`;
            if (result.pages) {
              processingDetails += ` (${result.pages} pages)`;
            }
            if (result.metadata.readabilityScore) {
              processingDetails += ` (readability: ${Math.round(result.metadata.readabilityScore * 100)}%)`;
            }
            processingDetails += ` (PDF type: ${result.pdfType})`;
            console.log('✅ PDF parsed successfully with advanced processor:', {
              method: result.method,
              pdfType: result.pdfType,
              contentLength: result.content.length,
              wordCount: result.wordCount,
              pages: result.pages,
              processingTime: result.processingTime,
              readabilityScore: result.metadata.readabilityScore,
              hasTextLayer: result.metadata.hasTextLayer,
              hasImages: result.metadata.hasImages,
              chunkCount: result.metadata.chunkCount
            });
          } else {
            // Fallback to original PDF extractor if improved processor fails
            console.log('⚠️ Improved PDF processor failed, trying original extractor...');
            const { extractPDFContent } = await import('@/lib/pdf-extractor');
            const fallbackResult = await extractPDFContent(buffer, fileName);
            
            if (fallbackResult.success) {
              extractedContent = fallbackResult.content;
              processingDetails = `PDF extraction successful (fallback): ${fallbackResult.metadata.method} - ${fallbackResult.content.length} characters extracted`;
              if (fallbackResult.metadata.pages) {
                processingDetails += ` (${fallbackResult.metadata.pages} pages)`;
              }
              console.log('✅ PDF parsed successfully with fallback extractor:', {
                method: fallbackResult.metadata.method,
                contentLength: fallbackResult.content.length,
                wordCount: fallbackResult.metadata.wordCount,
                pages: fallbackResult.metadata.pages
              });
            } else {
              // Use the detailed fallback content from the extractor
              extractedContent = fallbackResult.content; // This contains detailed error explanation
              processingDetails = `PDF extraction failed: ${fallbackResult.metadata.method} - ${fallbackResult.metadata.error}`;
              console.log('⚠️ PDF extraction failed but provided detailed explanation:', {
                method: fallbackResult.metadata.method,
                error: fallbackResult.metadata.error,
                warnings: fallbackResult.metadata.warnings
              });
            }
          }
          
        } catch (pdfError) {
          console.error('❌ PDF processing failed completely:', pdfError);
          console.error('PDF error details:', {
            message: pdfError instanceof Error ? pdfError.message : 'Unknown error',
            fileName: fileName,
            fileType: fileType,
            url: item.fileUrl
          });
          
          // Final fallback if file access or extractor completely fails
          let errorCategory = 'Unknown error';
          if (pdfError instanceof Error) {
            if (pdfError.message.includes('file not found') || pdfError.message.includes('404')) {
              errorCategory = 'File not found in storage';
            } else if (pdfError.message.includes('permission') || pdfError.message.includes('403')) {
              errorCategory = 'Permission denied accessing file';
            } else if (pdfError.message.includes('Failed to extract file ID')) {
              errorCategory = 'Invalid file URL format';
            } else {
              errorCategory = pdfError.message;
            }
          }
          
          extractedContent = `PDF Document: ${fileName}

Critical PDF Processing Error

The PDF file could not be processed due to a system-level error.

Error Category: ${errorCategory}

File Information:
- File Name: ${fileName}
- File Size: ${item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : 'Unknown'}
- Created: ${new Date(item.createdAt || item.createdAt).toLocaleDateString()}
- Storage URL: ${item.fileUrl ? 'Available' : 'Missing'}

This error suggests:
- File storage access issues
- Corrupted file storage entry
- Invalid file URL configuration
- System service unavailability

Please try:
1. Re-uploading the PDF file
2. Checking file permissions
3. Contacting support if the issue persists`;
          
          processingDetails = `Critical PDF error: ${errorCategory}`;
        }
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 fileType === 'application/vnd.ms-excel' || 
                 fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        contentType = 'Excel spreadsheet';
        console.log('📊 Parsing Excel file...');
        
        try {
          // Extract file ID from URL
          const fileId = extractFileId(item.fileUrl);
          console.log('📂 File ID extracted:', fileId);
          
          // Download file content
          const fileBuffer = await storage.getFileDownload('files', fileId);
          const uint8Array = new Uint8Array(fileBuffer);
          const buffer = Buffer.from(uint8Array);
          
          // Extract text using XLSX
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          let content = '';
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_csv(sheet);
            content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
          });
          extractedContent = content;
          processingDetails = `Excel parsing: ${extractedContent.length} characters extracted`;
          console.log('✅ Excel parsed successfully:', processingDetails);
          
        } catch (excelError) {
          console.error('❌ Excel parsing failed:', excelError);
          extractedContent = `Excel parsing failed: ${excelError instanceof Error ? excelError.message : 'Unknown error'}`;
          processingDetails = 'Excel parsing error';
        }
      } else if (fileType === 'text/plain' || fileType === 'text/csv' || 
                 fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.md')) {
        // Parse text files
        contentType = 'Text file';
        console.log('📝 Parsing text file...');
        
        try {
          // Extract file ID from URL
          const fileId = extractFileId(item.fileUrl);
          console.log('📂 File ID extracted:', fileId);
          
          // Download file content
          const fileBuffer = await storage.getFileDownload('files', fileId);
          const uint8Array = new Uint8Array(fileBuffer);
          const buffer = Buffer.from(uint8Array);
          
          // Extract text content
          const textContent = buffer.toString('utf-8');
          extractedContent = textContent;
          processingDetails = `Text parsing: ${extractedContent.length} characters extracted`;
          console.log('✅ Text parsed successfully:', processingDetails);
          
        } catch (textError) {
          console.error('❌ Text parsing failed:', textError);
          extractedContent = `Text parsing failed: ${textError instanceof Error ? textError.message : 'Unknown error'}`;
          processingDetails = 'Text parsing error';
        }
      } else {
        // For other file types, use metadata for now
        extractedContent = `Document: ${fileName}
File Type: ${fileType}
File Size: ${item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : 'Unknown'}
Created: ${new Date(item.createdAt || item.createdAt).toLocaleDateString()}

This file type is not yet supported for content extraction.`;
        processingDetails = 'Metadata only (unsupported file type)';
      }
    } 
    // Handle links - check for extracted content or fall back to preview image
    else if (item.fileType === 'link') {
      if (item.content && item.content.length > 50) {
        // Use the extracted text content from the database
        extractedContent = item.content;
        processingDetails = 'Pre-extracted link content';
        contentType = item.fileType || 'web-content';
        
        console.log('✅ Using extracted link content:', {
          type: item.fileType,
          length: extractedContent.length,
          wordCount: extractedContent.split(/\s+/).length
        });
      } else {
        // Use metadata for links without extracted content
        extractedContent = `Link: ${item.title}
URL: ${item.fileUrl}
Type: ${item.fileType}
Created: ${new Date(item.createdAt).toLocaleDateString()}

Content extraction may not have been completed for this link.`;
        processingDetails = 'Metadata only (no extracted content)';
      }
    } else {
      // For other types, use metadata
      extractedContent = `Item: ${item.title}
Type: ${item.fileType}
${item.fileUrl ? `URL: ${item.fileUrl}` : ''}
Created: ${new Date(item.createdAt).toLocaleDateString()}`;
      processingDetails = 'Metadata only';
    }

    // Generate AI summary if we have content
    let summary = '';
    
    if (extractedContent && extractedContent.length > 50) {
      console.log('🤖 Generating AI summary with Gemini...');
      
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        });

        const prompt = `Please provide a comprehensive and well-structured summary of the following ${contentType}. Use proper markdown formatting to make it visually appealing and easy to read.

**Requirements:**
- Use markdown formatting (headers, lists, emphasis, etc.)
- Structure with clear headings and bullet points
- Include key insights and main takeaways
- Keep it concise but comprehensive
- Use **bold** for important terms and *italics* for emphasis

Item: ${item.title || 'Unknown'}
Content Type: ${contentType}
Source: ${item.fileUrl || 'File'}

Content to summarize:
${extractedContent.substring(0, 15000)}${extractedContent.length > 15000 ? '...[content truncated for processing]' : ''}

Please create a well-formatted markdown summary that captures the essence of this content:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        summary = response.text() || 'Unable to generate summary.';
        
        console.log('✅ AI summary generated successfully');
        
      } catch (aiError) {
        console.error('❌ AI summary generation failed:', aiError);
        summary = `AI summary generation failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`;
      }
    } else {
      // Fallback to metadata-based summary with improved markdown
      if (item.fileType !== 'link') {
        summary = `# 📄 ${item.title}

## File Details
- **File Type:** ${item.fileType || 'Unknown'}
- **File Size:** ${item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : 'Unknown'}
- **Created:** ${new Date(item.createdAt).toLocaleDateString()}

## Description
This is a ${item.fileType?.includes('word') ? 'Word document' : item.fileType?.includes('pdf') ? 'PDF document' : 'file'} that was uploaded to your dashboard. Content extraction ${processingDetails.includes('error') ? 'failed' : 'is not yet available for this file type'}.`;
      } else if (item.fileType === 'link') {
        const hasExtractedContent = item.content && item.content.length > 50;
        summary = `# 🔗 ${item.title}

## Link Details
- **URL:** ${item.fileUrl}
- **Content Type:** ${item.fileType || 'Link'}
- **Created:** ${new Date(item.createdAt).toLocaleDateString()}

## Description
This ${hasExtractedContent ? getContentTypeDescription(item.fileType) : 'link'} was saved to your dashboard${hasExtractedContent ? ' with extracted content' : ''}.`;
      } else {
        summary = `# 📋 ${item.title}

## Item Details
- **Type:** ${item.fileType}
- **Created:** ${new Date(item.createdAt).toLocaleDateString()}

## Description
This item was saved to your dashboard.`;
      }
    }

    console.log('✅ Summary generation completed');
    console.log('📊 Processing details:', processingDetails);
    
    // Return summary with detailed metadata
    return NextResponse.json({ 
      success: true,
      summary,
      metadata: {
        contentType,
        processingDetails,
        extractedContentLength: extractedContent.length,
        hasPreExtractedContent: !!(item.content && item.fileType && item.fileType !== 'preview'),
        itemDetails: {
          name: item.title,
          type: item.fileType,
          fileType: item.fileType,
          contentType: item.fileType,
          hasUrl: !!item.fileUrl,
          hasPreviewImage: !!item.content,
          hasExtractedContent: !!item.content,
          fileSize: item.fileSize
        }
      }
    });
    
  } catch (error: any) {
    console.error('❌ Summary generation error:', error);
    return NextResponse.json({ 
      summary: `Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: true
    }, { status: 500 });
  }
}

// Helper function to get user-friendly content type descriptions
function getContentTypeDescription(contentType: string): string {
  switch (contentType) {
    case 'transcript':
      return 'YouTube video with transcript';
    case 'web-content':
      return 'website with scraped content';
    case 'pdf':
      return 'PDF document with extracted text';
    case 'docx':
      return 'Word document with extracted text';
    case 'excel':
      return 'Excel spreadsheet with extracted data';
    case 'text':
      return 'text file with extracted content';
    case 'powerpoint':
      return 'PowerPoint presentation';
    default:
      return 'content';
  }
} 