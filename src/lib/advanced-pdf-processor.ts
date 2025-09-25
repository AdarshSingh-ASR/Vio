import { Buffer } from 'buffer';

export interface PDFProcessingResult {
  success: boolean;
  content: string;
  method: string;
  wordCount: number;
  pages: number;
  processingTime: number;
  pdfType: 'text' | 'image' | 'mixed' | 'unknown';
  metadata: {
    originalLength: number;
    cleanedLength: number;
    reconstructionAttempts: number;
    readabilityScore: number;
    hasTextLayer: boolean;
    hasImages: boolean;
    chunkCount: number;
    sourceInfo: {
      filename?: string;
      uploadDate: string;
      pageNumbers: number[];
    };
  };
}

export interface PDFChunk {
  content: string;
  page: number;
  type: 'text' | 'table' | 'image' | 'header' | 'footer';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class AdvancedPDFProcessor {
  private static instance: AdvancedPDFProcessor;
  
  public static getInstance(): AdvancedPDFProcessor {
    if (!AdvancedPDFProcessor.instance) {
      AdvancedPDFProcessor.instance = new AdvancedPDFProcessor();
    }
    return AdvancedPDFProcessor.instance;
  }

  async processPDF(buffer: Buffer, fileName?: string): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting advanced PDF processing for ${fileName || 'unknown'}`);
      
      // Step 1: Detect PDF type
      const pdfType = await this.detectPDFType(buffer);
      console.log(`📊 PDF type detected: ${pdfType}`);
      
      let result: PDFProcessingResult;
      
      // Step 2: Process based on type
      switch (pdfType) {
        case 'text':
          result = await this.processTextPDF(buffer, startTime, fileName);
          break;
        case 'image':
          result = await this.processImagePDF(buffer, startTime, fileName);
          break;
        case 'mixed':
          result = await this.processMixedPDF(buffer, startTime, fileName);
          break;
        default:
          result = await this.processUnknownPDF(buffer, startTime, fileName);
      }
      
      // Step 3: Intelligent chunking and final processing
      const finalResult = await this.finalizeProcessing(result, buffer, fileName);
      
      return finalResult;

    } catch (error) {
      console.error('❌ Advanced PDF processing failed:', error);
      return {
        success: false,
        content: this.generateErrorContent(error, fileName),
        method: 'error',
        wordCount: 0,
        pages: 0,
        processingTime: Date.now() - startTime,
        pdfType: 'unknown',
        metadata: {
          originalLength: 0,
          cleanedLength: 0,
          reconstructionAttempts: 0,
          readabilityScore: 0,
          hasTextLayer: false,
          hasImages: false,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers: []
          }
        }
      };
    }
  }

  private async detectPDFType(buffer: Buffer): Promise<'text' | 'image' | 'mixed' | 'unknown'> {
    try {
      console.log('🔍 Detecting PDF type...');
      
      // Method 1: Try pdfjs-dist if available
      try {
        const pdfjs = await import('pdfjs-dist');
        const pdfData = await pdfjs.getDocument({ data: buffer }).promise;
        
        let textContent = '';
        let imageCount = 0;
        let hasTextLayer = false;
        
        for (let i = 1; i <= Math.min(pdfData.numPages, 3); i++) { // Check first 3 pages only
          const page = await pdfData.getPage(i);
          const textLayer = await page.getTextContent();
          
          if (textLayer.items && textLayer.items.length > 0) {
            hasTextLayer = true;
            textContent += textLayer.items.map((item: any) => item.str).join(' ');
          }
          
          // Check for images (simplified)
          try {
            const ops = await page.getOperatorList();
            // Look for image-related operators (simplified check)
            if (ops.fnArray.some((op: number) => op === 69 || op === 70)) { // Common image ops
              imageCount++;
            }
          } catch (opError) {
            // Skip operator list check if not available
          }
        }
        
        console.log(`📊 PDF analysis: ${textContent.length} chars, ${imageCount} images, hasTextLayer: ${hasTextLayer}`);
        
        // Determine type based on analysis
        if (hasTextLayer && textContent.length > 100) {
          return imageCount > 0 ? 'mixed' : 'text';
        } else if (imageCount > 0) {
          return 'image';
        } else {
          return 'unknown';
        }
        
      } catch (pdfjsError) {
        console.log('⚠️ pdfjs-dist detection failed, trying alternative...');
        
        // Method 2: Fallback to binary analysis
        const binaryAnalysis = this.analyzePDFBinary(buffer);
        return binaryAnalysis.type;
      }
      
    } catch (error) {
      console.error('❌ PDF type detection failed:', error);
      return 'unknown';
    }
  }

  private analyzePDFBinary(buffer: Buffer): { type: 'text' | 'image' | 'mixed' | 'unknown'; confidence: number } {
    const content = buffer.toString('binary');
    
    // Look for text-related patterns
    const textPatterns = [
      /\/Font\b/g,
      /\/Type1\b/g,
      /\/TrueType\b/g,
      /BT\s+ET/g, // Text objects
      /Tj\b/g, // Show text
      /TJ\b/g // Show text with spacing
    ];
    
    // Look for image-related patterns
    const imagePatterns = [
      /\/Image\b/g,
      /\/XObject\b/g,
      /\/DCTDecode\b/g, // JPEG
      /\/JPXDecode\b/g, // JPEG2000
      /\/FlateDecode\b/g // PNG/compressed
    ];
    
    let textScore = 0;
    let imageScore = 0;
    
    textPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) textScore += matches.length;
    });
    
    imagePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) imageScore += matches.length;
    });
    
    console.log(`📊 Binary analysis: textScore=${textScore}, imageScore=${imageScore}`);
    
    if (textScore > 5 && imageScore < 3) return { type: 'text', confidence: 0.8 };
    if (imageScore > 3 && textScore < 2) return { type: 'image', confidence: 0.8 };
    if (textScore > 2 && imageScore > 2) return { type: 'mixed', confidence: 0.7 };
    return { type: 'unknown', confidence: 0.3 };
  }

  private async processTextPDF(buffer: Buffer, startTime: number, fileName?: string): Promise<PDFProcessingResult> {
    console.log('📝 Processing text-based PDF...');
    
    // Try pdf2json first (more reliable)
    try {
      const PDFParser = await import('pdf2json');
      const pdfParser = new (PDFParser as any).default();
      
      const result = await new Promise<any>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', reject);
        pdfParser.on('pdfParser_dataReady', resolve);
        pdfParser.parseBuffer(buffer);
      });
      
      let allText = '';
      const pageNumbers: number[] = [];
      
      if (result.Pages && result.Pages.length > 0) {
        result.Pages.forEach((page: any, index: number) => {
          if (page.Texts && page.Texts.length > 0) {
            pageNumbers.push(index + 1);
            page.Texts.forEach((text: any) => {
              if (text.R && text.R.length > 0) {
                text.R.forEach((run: any) => {
                  if (run.T) {
                    allText += decodeURIComponent(run.T) + ' ';
                  }
                });
              }
            });
            allText += '\n\n';
          }
        });
      }
      
      const cleanedText = this.cleanAndStructureText(allText);
      
      return {
        success: true,
        content: cleanedText,
        method: 'pdf2json-text',
        wordCount: cleanedText.split(/\s+/).length,
        pages: result.Pages?.length || 0,
        processingTime: Date.now() - startTime,
        pdfType: 'text',
        metadata: {
          originalLength: allText.length,
          cleanedLength: cleanedText.length,
          reconstructionAttempts: 0,
          readabilityScore: this.calculateReadabilityScore(cleanedText),
          hasTextLayer: true,
          hasImages: false,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers
          }
        }
      };
      
    } catch (pdf2jsonError) {
      console.log('⚠️ pdf2json failed, trying pdfjs-dist...');
      
      // Try pdfjs-dist as fallback
      try {
        const pdfjs = await import('pdfjs-dist');
        const pdfData = await pdfjs.getDocument({ data: buffer }).promise;
        
        let allText = '';
        const chunks: PDFChunk[] = [];
        const pageNumbers: number[] = [];
        
        for (let i = 1; i <= pdfData.numPages; i++) {
          const page = await pdfData.getPage(i);
          const textContent = await page.getTextContent();
          
          if (textContent.items && textContent.items.length > 0) {
            pageNumbers.push(i);
            
            // Extract text with positioning
            let pageText = '';
            textContent.items.forEach((item: any) => {
              pageText += item.str + ' ';
              
              // Create chunks for structured content
              chunks.push({
                content: item.str,
                page: i,
                type: 'text',
                position: {
                  x: item.transform[4] || 0,
                  y: item.transform[5] || 0,
                  width: item.width || 0,
                  height: item.height || 0
                }
              });
            });
            
            allText += pageText + '\n\n';
          }
        }
        
        // Clean and process the text
        const cleanedText = this.cleanAndStructureText(allText, chunks);
        
        return {
          success: true,
          content: cleanedText,
          method: 'pdfjs-dist-text',
          wordCount: cleanedText.split(/\s+/).length,
          pages: pdfData.numPages,
          processingTime: Date.now() - startTime,
          pdfType: 'text',
          metadata: {
            originalLength: allText.length,
            cleanedLength: cleanedText.length,
            reconstructionAttempts: 0,
            readabilityScore: this.calculateReadabilityScore(cleanedText),
            hasTextLayer: true,
            hasImages: false,
            chunkCount: chunks.length,
            sourceInfo: {
              filename: fileName,
              uploadDate: new Date().toISOString(),
              pageNumbers
            }
          }
        };
        
      } catch (pdfjsError) {
        console.log('⚠️ pdfjs-dist failed, falling back to pdf-parse...');
        return await this.fallbackToPdfParse(buffer, startTime, 'text', fileName);
      }
    }
  }

  private async processImagePDF(buffer: Buffer, startTime: number, fileName?: string): Promise<PDFProcessingResult> {
    console.log('🖼️ Processing image-based PDF (OCR required)...');
    
    try {
      // Convert PDF pages to images and run OCR
      const Tesseract = await import('tesseract.js');
      
      // For now, we'll use a simplified approach
      // In a production environment, you'd convert PDF to images first
      const result = await Tesseract.recognize(buffer, 'eng', {
        logger: m => console.log(`OCR: ${m.status} - ${Math.round(m.progress * 100)}%`)
      });
      
      const cleanedText = this.cleanAndStructureText(result.data.text);
      
      return {
        success: true,
        content: cleanedText,
        method: 'tesseract-ocr',
        wordCount: cleanedText.split(/\s+/).length,
        pages: 1, // Would need proper page counting
        processingTime: Date.now() - startTime,
        pdfType: 'image',
        metadata: {
          originalLength: result.data.text.length,
          cleanedLength: cleanedText.length,
          reconstructionAttempts: 0,
          readabilityScore: this.calculateReadabilityScore(cleanedText),
          hasTextLayer: false,
          hasImages: true,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers: [1]
          }
        }
      };
      
    } catch (ocrError) {
      console.error('❌ OCR processing failed:', ocrError);
      return {
        success: false,
        content: this.generateImagePDFErrorContent(fileName),
        method: 'ocr-failed',
        wordCount: 0,
        pages: 0,
        processingTime: Date.now() - startTime,
        pdfType: 'image',
        metadata: {
          originalLength: 0,
          cleanedLength: 0,
          reconstructionAttempts: 0,
          readabilityScore: 0,
          hasTextLayer: false,
          hasImages: true,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers: []
          }
        }
      };
    }
  }

  private async processMixedPDF(buffer: Buffer, startTime: number, fileName?: string): Promise<PDFProcessingResult> {
    console.log('🔀 Processing mixed PDF (text + images)...');
    
    // Try text extraction first, then add image metadata
    const textResult = await this.processTextPDF(buffer, startTime, fileName);
    
    if (textResult.success) {
      // Add note about images
      const imageNote = '\n\n--- IMAGES DETECTED ---\nThis PDF contains images in addition to text. The above content represents the extractable text portions. Images may contain additional information not captured in this extraction.';
      
      return {
        ...textResult,
        content: textResult.content + imageNote,
        method: textResult.method + '-mixed',
        pdfType: 'mixed',
        metadata: {
          ...textResult.metadata,
          hasImages: true,
          cleanedLength: textResult.content.length + imageNote.length
        }
      };
    }
    
    return textResult;
  }

  private async processUnknownPDF(buffer: Buffer, startTime: number, fileName?: string): Promise<PDFProcessingResult> {
    console.log('❓ Processing unknown PDF type...');
    
    // Try all methods in sequence
    const methods = [
      () => this.processTextPDF(buffer, startTime, fileName),
      () => this.processImagePDF(buffer, startTime, fileName)
    ];
    
    for (const method of methods) {
      try {
        const result = await method();
        if (result.success && result.wordCount > 10) {
          return {
            ...result,
            method: result.method + '-unknown-fallback'
          };
        }
      } catch (error) {
        console.log('⚠️ Method failed, trying next...');
      }
    }
    
    // Final fallback
    return await this.fallbackToPdfParse(buffer, startTime, 'unknown', fileName);
  }

  private async fallbackToPdfParse(buffer: Buffer, startTime: number, detectedType: string, fileName?: string): Promise<PDFProcessingResult> {
    try {
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(buffer);
      
      const cleanedText = this.cleanAndStructureText(pdfData.text);
      
      return {
        success: true,
        content: cleanedText,
        method: `pdf-parse-fallback-${detectedType}`,
        wordCount: cleanedText.split(/\s+/).length,
        pages: pdfData.numpages || 0,
        processingTime: Date.now() - startTime,
        pdfType: detectedType as any,
        metadata: {
          originalLength: pdfData.text.length,
          cleanedLength: cleanedText.length,
          reconstructionAttempts: 0,
          readabilityScore: this.calculateReadabilityScore(cleanedText),
          hasTextLayer: true,
          hasImages: false,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers: Array.from({ length: pdfData.numpages || 1 }, (_, i) => i + 1)
          }
        }
      };
      
    } catch (error) {
      console.error('❌ All PDF processing methods failed:', error);
      return {
        success: false,
        content: this.generateErrorContent(error, fileName),
        method: 'all-methods-failed',
        wordCount: 0,
        pages: 0,
        processingTime: Date.now() - startTime,
        pdfType: 'unknown',
        metadata: {
          originalLength: 0,
          cleanedLength: 0,
          reconstructionAttempts: 0,
          readabilityScore: 0,
          hasTextLayer: false,
          hasImages: false,
          chunkCount: 0,
          sourceInfo: {
            filename: fileName,
            uploadDate: new Date().toISOString(),
            pageNumbers: []
          }
        }
      };
    }
  }

  private cleanAndStructureText(text: string, chunks?: PDFChunk[]): string {
    if (!text) return '';
    
    // Clean the text
    let cleaned = text
      // Remove PDF artifacts
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\b\d+\s+\d+\s+obj\b/g, ' ')
      .replace(/\bendobj\b/g, ' ')
      .replace(/\bstream\b[\s\S]*?\bendstream\b/g, ' ')
      .replace(/<<[^>]*>>/g, ' ')
      .replace(/\b\d+\s+\d+\s+R\b/g, ' ')
      // Remove coordinate data
      .replace(/\b\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\b/g, ' ')
      // Remove font references
      .replace(/\/[A-Za-z][A-Za-z0-9]*MT\b/g, ' ')
      .replace(/\/[A-Za-z][A-Za-z0-9]*\b(?=\s*\[)/g, ' ')
      // Clean whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Intelligent chunking at paragraph/section boundaries
    const structuredContent = this.intelligentChunking(cleaned);
    
    return structuredContent;
  }

  private intelligentChunking(text: string): string {
    // Split into paragraphs
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Process each paragraph
    const processedParagraphs = paragraphs.map(paragraph => {
      // Clean up the paragraph
      let cleaned = paragraph.trim();
      
      // Fix common issues
      cleaned = cleaned
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])\s*([.,!?;:])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Only keep paragraphs with meaningful content
      if (cleaned.length < 10 || !/[a-zA-Z]/.test(cleaned)) {
        return null;
      }
      
      return cleaned;
    }).filter(p => p !== null);
    
    // Join paragraphs with proper spacing
    return processedParagraphs.join('\n\n');
  }

  private async finalizeProcessing(result: PDFProcessingResult, buffer: Buffer, fileName?: string): Promise<PDFProcessingResult> {
    // Add source references and metadata
    const sourceInfo = `\n\n--- SOURCE INFORMATION ---
File: ${fileName || 'Unknown'}
Upload Date: ${new Date().toLocaleDateString()}
Processing Method: ${result.method}
PDF Type: ${result.pdfType}
Pages: ${result.pages}
Word Count: ${result.wordCount}
Readability Score: ${Math.round(result.metadata.readabilityScore * 100)}%`;

    return {
      ...result,
      content: result.content + sourceInfo,
      metadata: {
        ...result.metadata,
        cleanedLength: result.content.length + sourceInfo.length
      }
    };
  }

  private calculateReadabilityScore(text: string): number {
    if (!text || text.length === 0) return 0;
    
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const avgCharsPerWord = text.replace(/\s+/g, '').length / Math.max(words.length, 1);
    
    const meaningfulWords = words.filter(word => 
      word.length >= 2 && 
      /^[a-zA-Z]/.test(word) && 
      /[aeiouAEIOU]/.test(word.toLowerCase())
    );
    
    const meaningfulRatio = meaningfulWords.length / Math.max(words.length, 1);
    
    let score = 0;
    if (avgWordsPerSentence >= 3 && avgWordsPerSentence <= 25) score += 0.3;
    if (avgCharsPerWord >= 3 && avgCharsPerWord <= 8) score += 0.3;
    if (meaningfulRatio >= 0.7) score += 0.4;
    
    return Math.min(score, 1);
  }

  private generateErrorContent(error: any, fileName?: string): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return `PDF Processing Error

File: ${fileName || 'unknown'}
Error: ${errorMessage}
Date: ${new Date().toISOString()}

This PDF could not be processed due to the following reasons:
1. The PDF may be corrupted or malformed
2. Missing PDF processing dependencies
3. System configuration issues
4. Temporary service unavailability

Recommendations:
- Verify the PDF file is not corrupted
- Try converting to a different format
- Contact system administrator for support

For technical support, please provide this error message.`;
  }

  private generateImagePDFErrorContent(fileName?: string): string {
    return `Image PDF Processing Error

File: ${fileName || 'unknown'}
Date: ${new Date().toISOString()}

This PDF appears to be image-based or scanned, but OCR processing failed.

Possible reasons:
1. OCR service unavailable
2. Poor image quality
3. Unsupported language/script
4. System resource limitations

Recommendations:
- Ensure the PDF images are clear and readable
- Try using a different OCR service
- Convert images to higher resolution
- Contact system administrator for support`;
  }
}

// Export convenience function
export async function processPDFAdvanced(buffer: Buffer, fileName?: string): Promise<PDFProcessingResult> {
  const processor = AdvancedPDFProcessor.getInstance();
  return processor.processPDF(buffer, fileName);
}
