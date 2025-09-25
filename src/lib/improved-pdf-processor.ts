import { Buffer } from 'buffer';

export interface ImprovedPDFResult {
  success: boolean;
  content: string;
  method: string;
  wordCount: number;
  pages: number;
  processingTime: number;
  metadata: {
    originalLength: number;
    cleanedLength: number;
    reconstructionAttempts: number;
    readabilityScore: number;
  };
}

export class ImprovedPDFProcessor {
  private static instance: ImprovedPDFProcessor;
  
  public static getInstance(): ImprovedPDFProcessor {
    if (!ImprovedPDFProcessor.instance) {
      ImprovedPDFProcessor.instance = new ImprovedPDFProcessor();
    }
    return ImprovedPDFProcessor.instance;
  }

  async processPDF(buffer: Buffer, fileName?: string): Promise<ImprovedPDFResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting improved PDF processing for ${fileName || 'unknown'}`);
      
      // Try pdf-parse first
      const pdfParse = await import('pdf-parse').catch(err => {
        console.error('❌ pdf-parse import failed:', err);
        throw new Error('pdf-parse library not available');
      });

      const parseModule = pdfParse.default || pdfParse;
      
      if (typeof parseModule !== 'function') {
        throw new Error('pdf-parse module is not a function');
      }

      // Try multiple parsing approaches for better text extraction
      let pdfData;
      let parsingMethod = 'standard';
      
      try {
        // First try: Standard parsing
          pdfData = await parseModule(buffer, {
            max: 0,
            version: 'v1.10.100'
          });
        
        // Check if content is fragmented and try alternative approach
        if (pdfData.text && pdfData.text.length > 0) {
          const testScore = this.calculateReadabilityScore(pdfData.text);
          if (testScore < 0.3) {
            console.log('⚠️ Standard parsing produced fragmented content, trying alternative...');
            
            // Try with different options
            pdfData = await parseModule(buffer, {
              max: 0,
              version: 'v1.10.100'
            });
            parsingMethod = 'alternative';
          }
        }
      } catch (parseError) {
        console.log('⚠️ Primary parsing failed, trying fallback...');
        // Fallback with minimal options
        pdfData = await parseModule(buffer, {
          max: 0
        });
        parsingMethod = 'fallback';
      }

      const rawContent = pdfData.text || '';
      console.log(`📄 Raw content extracted: ${rawContent.length} characters`);
      
      if (rawContent.length === 0) {
        return {
          success: false,
          content: '',
          method: 'pdf-parse-empty',
          wordCount: 0,
          pages: pdfData.numpages || 0,
          processingTime: Date.now() - startTime,
          metadata: {
            originalLength: 0,
            cleanedLength: 0,
            reconstructionAttempts: 0,
            readabilityScore: 0
          }
        };
      }

      // Process the content with improved cleaning
      const processedContent = await this.processFragmentedContent(rawContent);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        content: processedContent.content,
        method: `improved-${processedContent.method}-${parsingMethod}`,
        wordCount: processedContent.wordCount,
        pages: pdfData.numpages || 0,
        processingTime,
        metadata: processedContent.metadata
      };

    } catch (error) {
      console.error('❌ Improved PDF processing failed:', error);
      return {
        success: false,
        content: this.generateErrorContent(error, fileName),
        method: 'error',
        wordCount: 0,
        pages: 0,
        processingTime: Date.now() - startTime,
        metadata: {
          originalLength: 0,
          cleanedLength: 0,
          reconstructionAttempts: 0,
          readabilityScore: 0
        }
      };
    }
  }

  private async processFragmentedContent(rawContent: string): Promise<{
    content: string;
    method: string;
    wordCount: number;
    metadata: {
      originalLength: number;
      cleanedLength: number;
      reconstructionAttempts: number;
      readabilityScore: number;
    };
  }> {
    const originalLength = rawContent.length;
    let reconstructionAttempts = 0;
    
    console.log(`🔍 Processing fragmented content: ${originalLength} chars`);
    
    // Show first 300 characters for debugging
    const preview = rawContent.substring(0, 300);
    console.log(`📝 Content preview:`, preview);
    
    // Step 1: Basic cleaning
    let cleaned = this.basicClean(rawContent);
    console.log(`🧹 After basic cleaning: ${cleaned.length} chars`);
    
    // Step 2: Try different reconstruction approaches
    let bestContent = cleaned;
    let bestScore = this.calculateReadabilityScore(cleaned);
    
    // Approach 1: Simple word joining
    const simpleReconstructed = this.simpleWordReconstruction(cleaned);
    reconstructionAttempts++;
    const simpleScore = this.calculateReadabilityScore(simpleReconstructed);
    if (simpleScore > bestScore) {
      bestContent = simpleReconstructed;
      bestScore = simpleScore;
      console.log(`✅ Simple reconstruction improved score: ${simpleScore}`);
    }
    
    // Approach 2: Advanced word joining
    const advancedReconstructed = this.advancedWordReconstruction(cleaned);
    reconstructionAttempts++;
    const advancedScore = this.calculateReadabilityScore(advancedReconstructed);
    if (advancedScore > bestScore) {
      bestContent = advancedReconstructed;
      bestScore = advancedScore;
      console.log(`✅ Advanced reconstruction improved score: ${advancedScore}`);
    }
    
    // Approach 3: Pattern-based reconstruction
    const patternReconstructed = this.patternBasedReconstruction(cleaned);
    reconstructionAttempts++;
    const patternScore = this.calculateReadabilityScore(patternReconstructed);
    if (patternScore > bestScore) {
      bestContent = patternReconstructed;
      bestScore = patternScore;
      console.log(`✅ Pattern reconstruction improved score: ${patternScore}`);
    }
    
    // Final cleanup
    const finalContent = this.finalCleanup(bestContent);
    
    // Extract meaningful content if the text is still fragmented
    let processedContent = finalContent;
    if (bestScore < 0.5) {
      console.log('⚠️ Low readability score, extracting meaningful content...');
      processedContent = this.extractMeaningfulContent(finalContent);
    }
    
    const wordCount = processedContent.split(/\s+/).filter(word => word.length > 0).length;
    
    console.log(`✅ Final processing complete: ${processedContent.length} chars, ${wordCount} words, score: ${bestScore}`);
    
    return {
      content: processedContent,
      method: bestScore > 0.6 ? 'success' : bestScore > 0.3 ? 'partial' : 'extracted',
      wordCount,
      metadata: {
        originalLength,
        cleanedLength: processedContent.length,
        reconstructionAttempts,
        readabilityScore: bestScore
      }
    };
  }

  private basicClean(text: string): string {
    return text
      // Remove binary data
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      // Remove PDF artifacts
      .replace(/\b\d+\s+\d+\s+obj\b/g, ' ')
      .replace(/\bendobj\b/g, ' ')
      .replace(/\bstream\b[\s\S]*?\bendstream\b/g, ' ')
      .replace(/<<[^>]*>>/g, ' ')
      .replace(/\b\d+\s+\d+\s+R\b/g, ' ')
      // Remove font references
      .replace(/\/[A-Za-z][A-Za-z0-9]*MT\b/g, ' ')
      .replace(/\/[A-Za-z][A-Za-z0-9]*\b(?=\s*\[)/g, ' ')
      // Remove coordinate data (like "0.0 0.0 595.5 841.92")
      .replace(/\b\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\b/g, ' ')
      // Remove image references (ImageB, ImageC, ImageI)
      .replace(/\bImage[A-Z]\b/g, ' ')
      // Remove date stamps like "D:20250802120922 00'00'"
      .replace(/D:\d{14}\s+\d{2}'00'/g, ' ')
      // Remove library references
      .replace(/\b(Twemoji Mozilla|Noto Sans CJK SCBold)\b/g, ' ')
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private simpleWordReconstruction(text: string): string {
    // Fix obvious word breaks and fragmented text
    return text
      .replace(/\b([a-zA-Z])\s+([a-zA-Z])\b/g, '$1$2') // Single letter splits
      .replace(/\b([a-zA-Z]{1,2})\s+([a-zA-Z]{2,})\b/g, (match, p1, p2) => {
        // Combine short fragments with longer words
        if (p1.length <= 2 && p2.length >= 3) {
          return p1 + p2;
        }
        return match;
      })
      // Fix common PDF fragmentation patterns
      .replace(/\b([a-zA-Z]+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)\b/g, (match, p1, p2, p3) => {
        // If all parts are short and could form a compound word
        if (p1.length <= 4 && p2.length <= 4 && p3.length <= 4) {
          const combined = p1 + p2 + p3;
          if (combined.length >= 6 && /[aeiouAEIOU]/.test(combined)) {
            return combined;
          }
        }
        return match;
      })
      // Fix spacing around punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s*([a-zA-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private advancedWordReconstruction(text: string): string {
    const words = text.split(/\s+/);
    const reconstructed = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      if (!word.trim()) continue;
      
      // If word is very short and next word is longer, try combining
      if (word.length <= 2 && /^[a-zA-Z]+$/.test(word) && i + 1 < words.length) {
        const nextWord = words[i + 1];
        if (nextWord && nextWord.length >= 3 && /^[a-zA-Z]+$/.test(nextWord)) {
          const combined = word + nextWord;
          
          // Check if combined word looks more like a real word
          if (combined.length >= 3 && /[aeiouAEIOU]/.test(combined)) {
            reconstructed.push(combined);
            i++; // Skip next word
            continue;
          }
        }
      }
      
      reconstructed.push(word);
    }
    
    return reconstructed.join(' ');
  }

  private patternBasedReconstruction(text: string): string {
    // Fix common PDF extraction patterns
    return text
      // Fix broken compound words
      .replace(/\b([a-zA-Z]+)\s+([a-zA-Z]+)\b/g, (match, p1, p2) => {
        // If both parts are reasonable length and could form a compound word
        if (p1.length >= 2 && p2.length >= 2 && 
            /^[a-zA-Z]+$/.test(p1) && /^[a-zA-Z]+$/.test(p2)) {
          const combined = p1 + p2;
          // Check if it looks like a real word
          if (combined.length >= 4 && /[aeiouAEIOU]/.test(combined)) {
            return combined;
          }
        }
        return match;
      })
      // Fix spacing around punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s*([.,!?;:])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private finalCleanup(text: string): string {
    return text
      // Fix spacing
      .replace(/\s+/g, ' ')
      // Fix punctuation spacing
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\s*([a-zA-Z])/g, '$1 $2')
      // Remove excessive punctuation
      .replace(/([.,!?;:])\1+/g, '$1')
      // Clean up remaining artifacts
      .replace(/\s+([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\s+/g, ' $1$2$3 ')
      // Remove standalone single characters
      .replace(/\s+[a-zA-Z]\s+/g, ' ')
      .trim();
  }

  private extractMeaningfulContent(text: string): string {
    // Extract URLs and important information
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const names = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    
    // Extract meaningful sentences (at least 10 characters, contains letters)
    const sentences = text.split(/[.!?]+/).filter(sentence => {
      const trimmed = sentence.trim();
      return trimmed.length >= 10 && /[a-zA-Z]/.test(trimmed);
    });
    
    // Combine meaningful content
    const meaningfulParts = [];
    
    if (sentences.length > 0) {
      meaningfulParts.push(sentences.join('. '));
    }
    
    if (urls.length > 0) {
      meaningfulParts.push('\n\nURLs found:\n' + urls.join('\n'));
    }
    
    if (emails.length > 0) {
      meaningfulParts.push('\n\nEmail addresses:\n' + emails.join('\n'));
    }
    
    if (names.length > 0) {
      meaningfulParts.push('\n\nNames mentioned:\n' + names.join('\n'));
    }
    
    return meaningfulParts.join('\n');
  }

  private calculateReadabilityScore(text: string): number {
    if (!text || text.length === 0) return 0;
    
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Basic readability metrics
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const avgCharsPerWord = text.replace(/\s+/g, '').length / Math.max(words.length, 1);
    
    // Check for meaningful content
    const meaningfulWords = words.filter(word => 
      word.length >= 2 && 
      /^[a-zA-Z]/.test(word) && 
      /[aeiouAEIOU]/.test(word.toLowerCase())
    );
    
    const meaningfulRatio = meaningfulWords.length / Math.max(words.length, 1);
    
    // Calculate score (0-1)
    let score = 0;
    
    // Good sentence length (not too short, not too long)
    if (avgWordsPerSentence >= 3 && avgWordsPerSentence <= 25) score += 0.3;
    
    // Good word length (not too short, not too long)
    if (avgCharsPerWord >= 3 && avgCharsPerWord <= 8) score += 0.3;
    
    // High ratio of meaningful words
    if (meaningfulRatio >= 0.7) score += 0.4;
    
    return Math.min(score, 1);
  }

  private generateErrorContent(error: any, fileName?: string): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return `PDF Processing Error

File: ${fileName || 'unknown'}
Error: ${errorMessage}

This PDF could not be processed due to the following reasons:
1. The PDF may be image-based or scanned
2. The PDF may be password-protected
3. The PDF may be corrupted or malformed
4. The PDF may contain complex formatting that cannot be extracted

Recommendations:
- Try converting the PDF to a text format
- Use OCR software to extract text from images
- Check if the PDF is password-protected
- Verify the PDF file is not corrupted

For technical support, please contact the system administrator.`;
  }
}

// Export convenience function
export async function processPDFWithImprovements(buffer: Buffer, fileName?: string): Promise<ImprovedPDFResult> {
  const processor = ImprovedPDFProcessor.getInstance();
  return processor.processPDF(buffer, fileName);
}
