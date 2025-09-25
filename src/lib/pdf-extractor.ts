import { Buffer } from 'buffer';

export interface PDFExtractionResult {
  success: boolean;
  content: string;
  metadata: {
    pages?: number;
    wordCount: number;
    method: string;
    processingTime: number;
    fileSize: number;
    hasText: boolean;
    error?: string;
    warnings?: string[];
  };
}

export class PDFExtractor {
  private static instance: PDFExtractor;
  
  public static getInstance(): PDFExtractor {
    if (!PDFExtractor.instance) {
      PDFExtractor.instance = new PDFExtractor();
    }
    return PDFExtractor.instance;
  }

  async extractFromBuffer(buffer: Buffer, fileName?: string): Promise<PDFExtractionResult> {
    const startTime = Date.now();
    const fileSize = buffer.length;
    
    console.log(`🔍 PDF Extraction started for ${fileName || 'unknown'}`);
    console.log(`📊 File size: ${Math.round(fileSize / 1024)} KB`);

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        content: '',
        metadata: {
          wordCount: 0,
          method: 'validation_failed',
          processingTime: Date.now() - startTime,
          fileSize: 0,
          hasText: false,
          error: 'Empty or invalid buffer provided'
        }
      };
    }

    // Check PDF header
    if (!this.isPDFBuffer(buffer)) {
      return {
        success: false,
        content: '',
        metadata: {
          wordCount: 0,
          method: 'format_validation',
          processingTime: Date.now() - startTime,
          fileSize,
          hasText: false,
          error: 'Buffer does not appear to be a valid PDF file'
        }
      };
    }

    // Try multiple extraction methods
    const results = await Promise.allSettled([
      this.extractWithPdfParse(buffer),
      this.extractWithPdfJs(buffer),
      this.extractWithAdvancedPdfParse(buffer),
      this.extractWithBinaryAnalysis(buffer)
    ]);

    // Evaluate results - prioritize by method quality
    const methodPriority = ['pdf-parse-advanced', 'pdf.js', 'pdf-parse', 'binary-analysis'];
    
    for (const method of methodPriority) {
      const result = results.find(r => 
        r.status === 'fulfilled' && 
        r.value.success && 
        r.value.metadata.method === method
      );
      
      if (result && result.status === 'fulfilled') {
        const processingTime = Date.now() - startTime;
        console.log(`✅ PDF extraction successful with ${result.value.metadata.method}`);
        console.log(`📊 Extracted ${result.value.content.length} characters in ${processingTime}ms`);
        
        return {
          ...result.value,
          metadata: {
            ...result.value.metadata,
            processingTime,
            fileSize
          }
        };
      }
    }

    // All methods failed - create informative fallback
    const processingTime = Date.now() - startTime;
    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason.message)
      .join('; ');

    console.log(`❌ All PDF extraction methods failed for ${fileName}`);
    console.log(`🔍 Errors: ${errors}`);

    return this.createFallbackResult(fileName || 'Unknown', fileSize, processingTime, errors);
  }

  private isPDFBuffer(buffer: Buffer): boolean {
    // Check for PDF magic number
    const pdfHeader = buffer.subarray(0, 4).toString('ascii');
    return pdfHeader === '%PDF';
  }

  private async extractWithPdfParse(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      console.log('🔄 Attempting extraction with pdf-parse...');
      
      // Dynamic import with error handling
      const pdfParse = await import('pdf-parse').catch(err => {
        console.error('❌ pdf-parse import failed:', err);
        throw new Error('pdf-parse library not available');
      });

      const parseModule = pdfParse.default || pdfParse;
      
      if (typeof parseModule !== 'function') {
        throw new Error('pdf-parse module is not a function');
      }

      const pdfData = await parseModule(buffer, {
        // Configuration options
        max: 0, // Parse all pages
        version: 'v1.10.100' // Specify version if needed
      });

      const rawContent = pdfData.text || '';
      
      // Clean and validate the extracted content
      const cleanedContent = this.cleanAndValidateContent(rawContent);
      const hasText = cleanedContent.length > 0;
      const wordCount = hasText ? cleanedContent.split(/\s+/).filter(word => word.length > 0).length : 0;

      console.log(`📊 PDF parse results:`, {
        rawLength: rawContent.length,
        cleanedLength: cleanedContent.length,
        wordCount,
        pages: pdfData.numpages || 0
      });

      if (!hasText || wordCount < 10) {
        console.log('⚠️ pdf-parse extracted PDF but found insufficient readable text');
        return {
          success: false,
          content: '',
          metadata: {
            pages: pdfData.numpages || 0,
            wordCount: 0,
            method: 'pdf-parse',
            processingTime: 0,
            fileSize: buffer.length,
            hasText: false,
            warnings: [`PDF processed but contains insufficient readable text (${wordCount} words found) - likely image-based, protected, or corrupted`]
          }
        };
      }

      console.log(`✅ pdf-parse successful: ${cleanedContent.length} chars, ${wordCount} words, ${pdfData.numpages || 0} pages`);

      return {
        success: true,
        content: cleanedContent,
        metadata: {
          pages: pdfData.numpages || 0,
          wordCount,
          method: 'pdf-parse',
          processingTime: 0,
          fileSize: buffer.length,
          hasText: true
        }
      };

    } catch (error) {
      console.error('❌ pdf-parse extraction failed:', error);
      throw error;
    }
  }

  private cleanAndValidateContent(rawContent: string): string {
    if (!rawContent) return '';

    try {
      console.log(`🔍 Raw content length: ${rawContent.length} characters`);
      
      // First, let's see what we're working with
      const firstChars = rawContent.substring(0, 200);
      console.log(`📝 First 200 chars:`, firstChars);
      
      // More intelligent cleaning that preserves fragmented text
      let cleaned = rawContent
        // Remove binary data patterns and PDF-specific artifacts
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        // Remove PDF object references but be more careful
        .replace(/\b\d+\s+\d+\s+obj\b/g, ' ')
        .replace(/\bendobj\b/g, ' ')
        // Remove PDF stream markers but preserve text content
        .replace(/\bstream\b[\s\S]*?\bendstream\b/g, ' ')
        // Remove PDF dictionary markers but preserve text
        .replace(/<<[^>]*>>/g, ' ')
        // Remove isolated PDF references but keep meaningful numbers
        .replace(/\b\d+\s+\d+\s+R\b/g, ' ')
        // Remove PDF font references but be careful not to remove regular text
        .replace(/\/[A-Za-z][A-Za-z0-9]*MT\b/g, ' ')
        .replace(/\/[A-Za-z][A-Za-z0-9]*\b(?=\s*\[)/g, ' ')
        // Clean up excessive whitespace but preserve structure
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`🧹 After basic cleaning: ${cleaned.length} characters`);
      
      // Try to reconstruct fragmented text
      const reconstructed = this.reconstructFragmentedText(cleaned);
      console.log(`🔧 After reconstruction: ${reconstructed.length} characters`);
      
      // More lenient validation for fragmented content
      if (reconstructed.length < 50) {
        console.log(`⚠️ Content too short after reconstruction (${reconstructed.length} chars)`);
        return '';
      }

      // Calculate the ratio of readable characters (more lenient)
      const readableChars = reconstructed.match(/[a-zA-Z0-9\s.,!?;:()\-"'\/\@\#\$\%\&\*\+=\[\]\{\}\|\\\~\`]/g) || [];
      const readableRatio = readableChars.length / reconstructed.length;

      // More lenient threshold for fragmented content
      if (readableRatio < 0.4) {
        console.log(`⚠️ Content appears to be non-text (${Math.round(readableRatio * 100)}% readable)`);
        return '';
      }

      // Check for meaningful content (more lenient)
      const words = reconstructed.split(/\s+/).filter(word => 
        word.length > 0 && 
        (/^[a-zA-Z0-9]/.test(word) || /[a-zA-Z]/.test(word)) // Starts with alphanumeric or contains letters
      );

      if (words.length < 5) {
        console.log(`⚠️ Insufficient meaningful words found (${words.length})`);
        return '';
      }

      console.log(`✅ Content validation passed: ${words.length} words, ${Math.round(readableRatio * 100)}% readable`);
      
      // Return the reconstructed content
      return reconstructed;

    } catch (error) {
      console.error('❌ Content cleaning failed:', error);
      return '';
    }
  }

  private reconstructFragmentedText(text: string): string {
    if (!text) return '';
    
    try {
      // Split into words and try to reconstruct sentences
      const words = text.split(/\s+/);
      const reconstructed = [];
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Skip empty words
        if (!word.trim()) continue;
        
        // If word looks like a fragment (very short, no vowels, etc.), try to combine with next word
        if (word.length <= 2 && /^[a-zA-Z]+$/.test(word) && !/[aeiouAEIOU]/.test(word)) {
          // Try to combine with next word
          if (i + 1 < words.length) {
            const nextWord = words[i + 1];
            const combined = word + nextWord;
            
            // Check if combined word makes more sense
            if (combined.length > word.length && /[aeiouAEIOU]/.test(combined)) {
              reconstructed.push(combined);
              i++; // Skip next word since we combined it
              continue;
            }
          }
        }
        
        // Add the word as-is
        reconstructed.push(word);
      }
      
      // Join words and clean up spacing
      let result = reconstructed.join(' ');
      
      // Fix common PDF extraction issues
      result = result
        // Fix broken words that might have been split
        .replace(/\b([a-zA-Z]{1,2})\s+([a-zA-Z]{2,})\b/g, (match, p1, p2) => {
          // If first part is very short and second part is longer, combine them
          if (p1.length <= 2 && p2.length >= 3) {
            return p1 + p2;
          }
          return match;
        })
        // Fix spacing around punctuation
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])\s*([.,!?;:])/g, '$1 $2')
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      return result;
      
    } catch (error) {
      console.error('❌ Text reconstruction failed:', error);
      return text; // Return original if reconstruction fails
    }
  }

  private async extractWithPdfJs(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      console.log('🔄 Attempting extraction with PDF.js...');
      
      // Try to dynamically import PDF.js with proper error handling
      let pdfjsLib;
      try {
        pdfjsLib = await import('pdfjs-dist');
      } catch (importError) {
        console.log('📦 PDF.js not available, skipping this method');
        throw new Error('PDF.js library not installed');
      }

      // Set worker path for PDF.js (Node.js environment)
      if (typeof window === 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        // In Node.js environment, disable worker to avoid path issues
        (pdfjsLib.GlobalWorkerOptions as any).workerSrc = false;
      }

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        verbosity: 0, // Reduce console output
        disableFontFace: true,
        disableRange: true,
        disableStream: true
      });

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      let fullText = '';

      console.log(`📄 PDF.js loaded ${numPages} pages`);

      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items into readable content
          const pageText = textContent.items
            .filter((item: any) => item.str && item.str.trim())
            .map((item: any) => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += pageText + '\n';
          }
        } catch (pageError) {
          console.warn(`⚠️ PDF.js failed to extract page ${pageNum}:`, pageError);
        }
      }

      // Clean and validate extracted content
      const cleanedContent = this.cleanAndValidateContent(fullText);
      const hasText = cleanedContent.length > 0;
      const wordCount = hasText ? cleanedContent.split(/\s+/).filter(word => word.length > 0).length : 0;

      console.log(`📊 PDF.js results:`, {
        pages: numPages,
        rawLength: fullText.length,
        cleanedLength: cleanedContent.length,
        wordCount
      });

      if (!hasText || wordCount < 10) {
        return {
          success: false,
          content: '',
          metadata: {
            pages: numPages,
            wordCount: 0,
            method: 'pdf.js',
            processingTime: 0,
            fileSize: buffer.length,
            hasText: false,
            warnings: [`PDF.js processed ${numPages} pages but found insufficient readable text (${wordCount} words)`]
          }
        };
      }

      console.log(`✅ PDF.js successful: ${cleanedContent.length} chars, ${wordCount} words, ${numPages} pages`);

      return {
        success: true,
        content: cleanedContent,
        metadata: {
          pages: numPages,
          wordCount,
          method: 'pdf.js',
          processingTime: 0,
          fileSize: buffer.length,
          hasText: true
        }
      };

    } catch (error) {
      console.error('❌ PDF.js extraction failed:', error);
      throw error;
    }
  }

  private async extractWithAdvancedPdfParse(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      console.log('🔄 Attempting advanced pdf-parse extraction...');
      
      const pdfParse = await import('pdf-parse').catch(err => {
        console.error('❌ pdf-parse import failed:', err);
        throw new Error('pdf-parse library not available');
      });

      const parseModule = pdfParse.default || pdfParse;
      
      if (typeof parseModule !== 'function') {
        throw new Error('pdf-parse module is not a function');
      }

      // Advanced configuration for better binary PDF handling
      const pdfData = await parseModule(buffer, {
        max: 0, // Parse all pages
        version: 'v1.10.100'
        // Note: Custom render functions are not officially supported in pdf-parse types
        // but the library may still accept them in practice
      } as any);

      const rawContent = pdfData.text || '';
      const cleanedContent = this.cleanAndValidateContent(rawContent);
      const hasText = cleanedContent.length > 0;
      const wordCount = hasText ? cleanedContent.split(/\s+/).filter(word => word.length > 0).length : 0;

      console.log(`📊 Advanced pdf-parse results:`, {
        rawLength: rawContent.length,
        cleanedLength: cleanedContent.length,
        wordCount,
        pages: pdfData.numpages || 0
      });

      if (!hasText || wordCount < 10) {
        return {
          success: false,
          content: '',
          metadata: {
            pages: pdfData.numpages || 0,
            wordCount: 0,
            method: 'pdf-parse-advanced',
            processingTime: 0,
            fileSize: buffer.length,
            hasText: false,
            warnings: [`Advanced pdf-parse found insufficient readable text (${wordCount} words)`]
          }
        };
      }

      console.log(`✅ Advanced pdf-parse successful: ${cleanedContent.length} chars, ${wordCount} words`);

      return {
        success: true,
        content: cleanedContent,
        metadata: {
          pages: pdfData.numpages || 0,
          wordCount,
          method: 'pdf-parse-advanced',
          processingTime: 0,
          fileSize: buffer.length,
          hasText: true
        }
      };

    } catch (error) {
      console.error('❌ Advanced pdf-parse extraction failed:', error);
      throw error;
    }
  }

  private async extractWithBinaryAnalysis(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      console.log('🔄 Attempting binary analysis extraction...');
      
      // Convert buffer to string with different encodings
      const encodings = ['utf8', 'latin1', 'ascii', 'binary'];
      let bestText = '';
      let bestScore = 0;
      
      for (const encoding of encodings) {
        try {
          const text = buffer.toString(encoding as BufferEncoding);
          
          // Extract potential text content using regex patterns (ES2017 compatible)
          const textPatterns = [
            // Common PDF text patterns
            /\[(.*?)\]/g,                    // Text in brackets
            /\((.*?)\)/g,                    // Text in parentheses  
            /BT\s+(.*?)\s+ET/g,             // Between BT/ET markers (removed 's' flag)
            /Tj\s*\[(.*?)\]/g,              // Tj text arrays
            /\d+\s+\d+\s+Td\s+\((.*?)\)/g, // Text with positioning
            // General readable text patterns
            /[A-Za-z][A-Za-z\s,.\-!?]{10,}/g, // Sequences of readable text
          ];
          
          let extractedText = '';
          
          for (const pattern of textPatterns) {
            const matches = text.match(pattern);
            if (matches) {
              for (const match of matches) {
                // Clean up the match
                const cleaned = match
                  .replace(/[\[\]()]/g, ' ')
                  .replace(/BT|ET|Tj|Td/g, '')
                  .replace(/\d+\s+\d+\s+/g, ' ')
                  .replace(/[^\w\s.,!?;:()\-"']/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (cleaned.length > 5) {
                  extractedText += cleaned + ' ';
                }
              }
            }
          }
          
          // Score the extracted text quality
          const words = extractedText.split(/\s+/).filter(word => 
            word.length > 1 && /^[a-zA-Z]/.test(word)
          );
          const score = words.length;
          
          if (score > bestScore) {
            bestScore = score;
            bestText = extractedText.trim();
          }
          
        } catch (encodingError) {
          console.warn(`⚠️ Failed to decode with ${encoding}:`, encodingError);
        }
      }
      
      const cleanedContent = this.cleanAndValidateContent(bestText);
      const hasText = cleanedContent.length > 0;
      const wordCount = hasText ? cleanedContent.split(/\s+/).filter(word => word.length > 0).length : 0;

      console.log(`📊 Binary analysis results:`, {
        rawLength: bestText.length,
        cleanedLength: cleanedContent.length,
        wordCount,
        bestScore
      });

      if (!hasText || wordCount < 5) {
        throw new Error(`Binary analysis found insufficient text (${wordCount} words)`);
      }

      console.log(`✅ Binary analysis successful: ${cleanedContent.length} chars, ${wordCount} words`);

      return {
        success: true,
        content: cleanedContent,
        metadata: {
          wordCount,
          method: 'binary-analysis',
          processingTime: 0,
          fileSize: buffer.length,
          hasText: true,
          warnings: ['Used binary analysis - results may be incomplete but readable text was found']
        }
      };

    } catch (error) {
      console.error('❌ Binary analysis extraction failed:', error);
      throw error;
    }
  }

  private async extractWithFallbackMethod(buffer: Buffer): Promise<PDFExtractionResult> {
    try {
      console.log('🔄 Attempting fallback extraction method...');
      
      // Try reading buffer as text (for simple PDFs)
      const textContent = buffer.toString('utf8');
      
      // Look for readable text patterns
      const textMatches = textContent.match(/[a-zA-Z\s]{10,}/g);
      
      if (textMatches && textMatches.length > 0) {
        const extractedText = textMatches.join(' ').trim();
        const wordCount = extractedText.split(/\s+/).length;
        
        if (wordCount > 5) { // Minimum threshold for meaningful content
          console.log(`✅ Fallback extraction found ${wordCount} words`);
          return {
            success: true,
            content: extractedText,
            metadata: {
              wordCount,
              method: 'fallback-text-extraction',
              processingTime: 0,
              fileSize: buffer.length,
              hasText: true,
              warnings: ['Used fallback text extraction - results may be incomplete']
            }
          };
        }
      }

      throw new Error('No extractable text found with fallback method');

    } catch (error) {
      console.error('❌ Fallback extraction failed:', error);
      throw error;
    }
  }

  private createFallbackResult(fileName: string, fileSize: number, processingTime: number, errors: string): PDFExtractionResult {
    const fallbackContent = `PDF Document: ${fileName}

⚠️ **Text Extraction Failed**

This PDF file was uploaded successfully but text extraction encountered issues.

**File Information:**
- File Name: ${fileName}
- File Size: ${Math.round(fileSize / 1024)} KB
- Processing Time: ${processingTime}ms

**Possible Reasons:**
1. **Image-based PDF**: The PDF contains only scanned images without selectable text
2. **Password Protection**: The PDF is encrypted or password-protected
3. **Corrupted File**: The PDF file structure may be damaged
4. **Unsupported Format**: The PDF uses features not supported by the text extractor
5. **Complex Layout**: The PDF has complex formatting that interferes with extraction

**Technical Details:**
${errors}

**What You Can Do:**
- Try saving the PDF as a text-selectable format
- Use OCR software to convert scanned images to text
- Check if the PDF is password-protected
- Try re-saving the PDF from the original application

Despite the extraction failure, you can still:
- View the PDF file
- Generate quizzes based on the file name and metadata
- Add manual notes or summaries`;

    return {
      success: false,
      content: fallbackContent,
      metadata: {
        wordCount: fallbackContent.split(/\s+/).length,
        method: 'metadata-fallback',
        processingTime,
        fileSize,
        hasText: false,
        error: 'All extraction methods failed',
        warnings: ['This is a fallback response with metadata only']
      }
    };
  }
}

// Export convenience function
export async function extractPDFContent(buffer: Buffer, fileName?: string): Promise<PDFExtractionResult> {
  const extractor = PDFExtractor.getInstance();
  return extractor.extractFromBuffer(buffer, fileName);
} 