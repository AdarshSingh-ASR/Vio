import { NextRequest, NextResponse } from 'next/server';
import { unfurl } from 'unfurl.js';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { fileTypeFromBuffer } from 'file-type';
import { uploadFile, getBucketForFileType, getFileView, ID, Permission, Role } from '@/lib/appwrite';
import { 
  dashboardItemService, 
  userService, 
  workspaceService 
} from '@/lib/tidb-service';

export const runtime = 'nodejs';

// Dynamic import for content extraction to handle missing dependencies gracefully
async function safeExtractContent(url: string) {
  try {
    const { extractContentFromUrl } = await import('@/lib/content-extractor');
    console.log('🔍 Attempting content extraction for:', url);
    
    const result = await extractContentFromUrl(url);
    console.log('📋 Content extraction result:', {
      success: result.success,
      contentType: result.contentType,
      contentLength: result.content.length,
      error: result.error
    });
    
    return result;
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return {
      success: false,
      content: '',
      contentType: 'preview' as const,
      error: error instanceof Error ? error.message : 'Content extraction failed',
      metadata: undefined
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Upload API: Starting JWT authentication check');
    
    // Get authenticated services with JWT
    const { storage, user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    
    console.log('Upload API: Authenticated user:', user.email);
    
    const formData = await req.formData();
    const file = formData.get('file');
    const link = formData.get('link');

    if (file && typeof file !== 'string') {
      // Handle file upload
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileType = file.type || '';
      const fileName = file.name || 'file';
      
      // --- Robust file type validation ---
      const detected = await fileTypeFromBuffer(buffer);
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const allowedTypes = [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
        // Videos
        'video/mp4', 'video/webm', 'video/quicktime',
        // PDFs
        'application/pdf',
        // Office docs (Word, Excel, PowerPoint)
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        'text/plain', 'text/csv',
      ];
      
      if (!detected || !allowedTypes.includes(detected.mime)) {
        return NextResponse.json({ error: 'Unsupported or unrecognized file type.' }, { status: 400 });
      }
      
      // Extra: check extension matches detected type (optional, but more robust)
      if (detected.ext && ext !== detected.ext && !(detected.mime.startsWith('image/') && ['jpg','jpeg','png','gif','webp','bmp'].includes(ext))) {
        return NextResponse.json({ error: `File extension does not match file content. Detected: .${detected.ext}` }, { status: 400 });
      }

      try {
        // Determine the appropriate bucket based on file type
        const bucketId = getBucketForFileType(detected.mime);
        
        // Create a File object from the buffer for Appwrite
        const fileBlob = new Blob([buffer], { type: detected.mime });
        const fileObject = new File([fileBlob], fileName, { type: detected.mime });
        
        // Upload to Appwrite Storage using authenticated storage service
        const timestamp = Date.now().toString();
        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileId = `${timestamp}_${cleanFileName}`.substring(0, 36);
        
        // Upload file (bucket now has 'any' permissions)
        const uploadResult = await storage.createFile(bucketId, fileId, fileObject);
        
        // Get the file URL
        const fileUrl = getFileView(bucketId, uploadResult.$id);
        const fileUrlString = fileUrl.toString();
        
        // Determine resource type for compatibility
        const isImage = detected.mime.startsWith('image/');
        const isVideo = detected.mime.startsWith('video/');
        const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';
        
        // Extract content from uploaded files
        let extractedContent = '';
        let contentType = 'preview';
        
        try {
          if (detected.mime === 'application/pdf') {
            console.log('📄 Extracting content from uploaded PDF...');
            console.log('📄 PDF buffer size:', buffer.length, 'bytes');
            
            try {
              // Use the advanced PDF processor with type detection and OCR fallback
              const { processPDFAdvanced } = await import('@/lib/advanced-pdf-processor');
              const result = await processPDFAdvanced(buffer, fileName);
              
              if (result.success) {
                // Handle content length limitations for Appwrite (70,000 char limit)
                const rawContent = result.content;
                if (rawContent.length > 65000) { // Leave some buffer for metadata
                  console.log(`⚠️ Content too long (${rawContent.length} chars), truncating for storage...`);
                  
                  // Intelligent truncation: keep beginning and add summary
                  const beginningContent = rawContent.substring(0, 60000);
                  const truncationSummary = `

--- CONTENT TRUNCATED ---
Original content length: ${rawContent.length.toLocaleString()} characters
Word count: ${result.wordCount.toLocaleString()} words
Extraction method: ${result.method}
PDF type: ${result.pdfType}
${result.pages ? `Pages: ${result.pages}` : ''}
Readability score: ${Math.round(result.metadata.readabilityScore * 100)}%
Has text layer: ${result.metadata.hasTextLayer ? 'Yes' : 'No'}
Has images: ${result.metadata.hasImages ? 'Yes' : 'No'}
Chunks: ${result.metadata.chunkCount}

This document was successfully processed with advanced PDF extraction but truncated for storage.
The full content is available for quiz generation and AI processing.
Showing first ~60,000 characters above.

--- END TRUNCATION NOTICE ---`;

                  extractedContent = beginningContent + truncationSummary;
                  
                  console.log(`✅ Content truncated: ${extractedContent.length} chars (from ${rawContent.length})`);
                } else {
                  extractedContent = rawContent;
                }
                
                contentType = 'pdf';
                console.log('✅ PDF content extracted successfully with advanced processor:', {
                  method: result.method,
                  pdfType: result.pdfType,
                  pages: result.pages || 'unknown',
                  originalLength: rawContent.length,
                  storedLength: extractedContent.length,
                  wordCount: result.wordCount,
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
                  // Handle content length limitations for Appwrite (70,000 char limit)
                  const rawContent = fallbackResult.content;
                  if (rawContent.length > 65000) { // Leave some buffer for metadata
                    console.log(`⚠️ Content too long (${rawContent.length} chars), truncating for storage...`);
                    
                    // Intelligent truncation: keep beginning and add summary
                    const beginningContent = rawContent.substring(0, 60000);
                    const truncationSummary = `

--- CONTENT TRUNCATED ---
Original content length: ${rawContent.length.toLocaleString()} characters
Word count: ${fallbackResult.metadata.wordCount.toLocaleString()} words
Extraction method: ${fallbackResult.metadata.method} (fallback)
${fallbackResult.metadata.pages ? `Pages: ${fallbackResult.metadata.pages}` : ''}

This document was successfully processed with fallback PDF extraction but truncated for storage.
The full content is available for quiz generation and AI processing.
Showing first ~60,000 characters above.

--- END TRUNCATION NOTICE ---`;

                    extractedContent = beginningContent + truncationSummary;
                    
                    console.log(`✅ Content truncated: ${extractedContent.length} chars (from ${rawContent.length})`);
                  } else {
                    extractedContent = rawContent;
                  }
                  
                  contentType = 'pdf';
                  console.log('✅ PDF content extracted successfully with fallback extractor:', {
                    method: fallbackResult.metadata.method,
                    pages: fallbackResult.metadata.pages || 'unknown',
                    originalLength: rawContent.length,
                    storedLength: extractedContent.length,
                    wordCount: fallbackResult.metadata.wordCount,
                    processingTime: fallbackResult.metadata.processingTime
                  });
                } else {
                  // Use the detailed fallback content from the extractor
                  extractedContent = fallbackResult.content; // This contains the detailed error explanation
                  contentType = 'pdf';
                  console.log('⚠️ PDF extraction failed but providing detailed fallback:', {
                    method: fallbackResult.metadata.method,
                    error: fallbackResult.metadata.error,
                    warnings: fallbackResult.metadata.warnings
                  });
                }
              }
            } catch (pdfError) {
              console.error('❌ PDF extractor failed completely:', pdfError);
              
              // Final fallback if even the robust extractor fails
              extractedContent = `PDF Document: ${fileName}

Critical PDF Extraction Error

The PDF file was uploaded successfully but the extraction system encountered a critical error.

Error Details: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}

File Information:
- File Name: ${fileName}
- File Size: ${Math.round(buffer.length / 1024)} KB
- File Type: application/pdf

This could indicate:
- Missing PDF processing dependencies
- System configuration issues
- Temporary service unavailability

The file has been saved and can be viewed, but text extraction is not available at this time.`;
              contentType = 'pdf';
            }
          } else if (detected.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     detected.mime === 'application/msword') {
            console.log('📝 Extracting content from uploaded DOCX...');
            const { extractDocxContent } = await import('@/lib/content-extractor');
            const result = await extractDocxContent(buffer);
            if (result.success) {
              extractedContent = result.content;
              contentType = result.contentType;
              console.log('✅ DOCX content extracted:', result.content.length, 'characters');
            } else {
              console.log('⚠️ DOCX extraction failed:', result.error);
              extractedContent = `Word Document: ${fileName}

DOCX text extraction failed: ${result.error}

File size: ${Math.round(buffer.length / 1024)} KB`;
              contentType = 'docx';
            }
          } else if (detected.mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                     detected.mime === 'application/vnd.ms-excel') {
            console.log('📊 Extracting content from uploaded Excel file...');
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let content = '';
            workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const sheetData = XLSX.utils.sheet_to_csv(sheet);
              content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
            });
            if (content.trim()) {
              extractedContent = content;
              contentType = 'excel';
              console.log('✅ Excel content extracted:', content.length, 'characters');
            }
          } else if (detected.mime === 'text/plain' || detected.mime === 'text/csv') {
            console.log('📝 Extracting content from text file...');
            const textContent = buffer.toString('utf-8');
            if (textContent.trim()) {
              extractedContent = textContent;
              contentType = 'text';
              console.log('✅ Text content extracted:', textContent.length, 'characters');
            }
          } else if (detected.mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
                     detected.mime === 'application/vnd.ms-powerpoint') {
            console.log('📊 PowerPoint file detected - text extraction not yet implemented');
            extractedContent = `PowerPoint Presentation: ${fileName}
File Type: ${detected.mime}
File Size: ${Math.round(buffer.length / 1024)} KB
Created: ${new Date().toLocaleDateString()}

This PowerPoint file has been saved. Text extraction from PowerPoint files is coming soon.`;
            contentType = 'powerpoint';
          }
        } catch (extractionError) {
          console.error('❌ File content extraction failed:', extractionError);
          console.error('Extraction error details:', {
            message: extractionError instanceof Error ? extractionError.message : 'Unknown error',
            fileName: fileName,
            fileType: detected.mime,
            fileSize: buffer.length
          });
          
          // Don't fail the upload if extraction fails - provide metadata instead
          extractedContent = `Document: ${fileName}
File Type: ${detected.mime}
File Size: ${Math.round(buffer.length / 1024)} KB
Upload Date: ${new Date().toLocaleDateString()}

Content extraction failed: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}

The file was uploaded successfully but text extraction encountered an issue.`;
          contentType = 'preview';
        }

        // Get user from TiDB database
        const dbUser = await userService.getByAppwriteUserId(userId);
        if (!dbUser) {
          return NextResponse.json(
            { error: 'User not found in database' },
            { status: 404 }
          );
        }
        
        // Get or create default workspace for the user
        let workspaces = await workspaceService.getByUserId(dbUser.id);
        let workspaceId: string;
        
        if (!workspaces || workspaces.length === 0) {
          // Create default workspace if none exists
          const newWorkspace = await workspaceService.create({
            name: 'Default Workspace',
            description: 'Default workspace for user files',
            userId: dbUser.id,
            isDefault: true
          });
          workspaceId = newWorkspace.id;
        } else {
          workspaceId = workspaces[0].id;
        }
        
        // Store metadata in TiDB using dashboard item service
        const newItem = await dashboardItemService.create({
          title: fileName,
          displayName: fileName, // Set displayName as copy of title initially
          description: `Uploaded file: ${fileName}`,
          content: extractedContent || '',
          fileType: detected.mime,
          fileSize: buffer.length,
          fileUrl: fileUrlString,
          appwriteFileId: uploadResult.$id,
          appwriteBucketId: bucketId,
          workspaceId: workspaceId,
          createdBy: dbUser.id
        });
        
        console.log('File uploaded successfully:', fileName);
        console.log('File processing result:', {
          fileName: fileName,
          fileType: detected.mime,
          extractedContentLength: extractedContent.length,
          contentType: contentType
        });
        
        return NextResponse.json({
          success: true,
          message: 'File uploaded successfully',
          item: newItem,
          fileUrl: fileUrlString
        });
        
      } catch (error: any) {
        console.error('File upload error:', error);
        return NextResponse.json({ error: 'File upload failed.', details: error.message }, { status: 500 });
      }
      
    } else if (typeof link === 'string') {
      // Handle link upload with enhanced content extraction
      console.log('Processing link:', link);
      
      let previewTitle = link;
      let previewImage = '';
      let extractedContent = '';
      let contentType = 'preview';
      
      // First, try to get basic preview with unfurl
      try {
        const preview = await unfurl(link);
        previewTitle = preview.title || link;
        previewImage = preview.open_graph?.images?.[0]?.url || '';
        console.log('Unfurl preview obtained:', { title: previewTitle, hasImage: !!previewImage });
      } catch (e) {
        console.log('Unfurl error (non-critical):', e);
      }
      
      // Now extract content based on URL type (if API keys are available)
      console.log('Starting content extraction for:', link);
      try {
        const contentResult = await safeExtractContent(link);
        
        if (contentResult.success && contentResult.content) {
          extractedContent = contentResult.content;
          contentType = contentResult.contentType;
          
          // Update title with extracted metadata if available
          if (contentResult.metadata?.title && contentResult.metadata.title !== link) {
            previewTitle = contentResult.metadata.title;
          }
          
          console.log('Content extraction successful:', {
            type: contentResult.contentType,
            contentLength: extractedContent.length,
            wordCount: contentResult.metadata?.wordCount || 0
          });
        } else {
          console.log('Content extraction failed or returned no content:', contentResult.error);
        }
      } catch (extractionError) {
        console.error('Content extraction error:', extractionError);
        // Don't fail the entire request if content extraction fails
      }
      
      // Get user from TiDB database
      const dbUser = await userService.getByAppwriteUserId(userId);
      if (!dbUser) {
        return NextResponse.json(
          { error: 'User not found in database' },
          { status: 404 }
        );
      }
      
      // Get or create default workspace for the user
      let workspaces = await workspaceService.getByUserId(dbUser.id);
      let workspaceId: string;
      
      if (!workspaces || workspaces.length === 0) {
        // Create default workspace if none exists
        const newWorkspace = await workspaceService.create({
          name: 'Default Workspace',
          description: 'Default workspace for user files',
          userId: dbUser.id,
          isDefault: true
        });
        workspaceId = newWorkspace.id;
      } else {
        workspaceId = workspaces[0].id;
      }
      
      // Store in TiDB using dashboard item service
      try {
        const newItem = await dashboardItemService.create({
          title: previewTitle,
          displayName: previewTitle, // Set displayName as copy of title initially
          description: `Link: ${link}`,
          content: extractedContent || '',
          previewImageUrl: previewImage || undefined,
          fileType: 'link',
          fileSize: 0,
          fileUrl: link,
          appwriteFileId: undefined,
          appwriteBucketId: undefined,
          workspaceId: workspaceId,
          createdBy: dbUser.id
        });
        
        console.log('Link saved successfully:', link);
        console.log('Saved item data:', {
          id: newItem.id,
          title: newItem.title,
          description: newItem.description,
          url: newItem.fileUrl,
          extractedContentLength: newItem.content ? newItem.content.length : 0
        });
        
        return NextResponse.json({
          success: true,
          message: 'Link saved successfully',
          item: newItem
        });
      } catch (error: any) {
        console.error('Link save error:', error);
        return NextResponse.json({ error: 'Failed to save link', details: error.message }, { status: 500 });
      }
    } else {
      // Fallback for missing file or link
      return NextResponse.json({ error: 'No file or link provided.' }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('Upload API authentication error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}

// File storage migration completed - now using Appwrite Storage
// Removed dependencies: Supabase, Cloudinary
// Added: Appwrite Storage with intelligent bucket routing based on file type 