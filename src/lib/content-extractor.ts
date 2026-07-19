import FirecrawlApp from '@mendable/firecrawl-js';
import mammoth from 'mammoth';
import { fileTypeFromBuffer } from 'file-type';

// Initialize Firecrawl
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || ''
});

export interface ContentExtractionResult {
  success: boolean;
  content: string;
  contentType: 'text' | 'transcript' | 'video-description' | 'web-content' | 'pdf' | 'docx' | 'preview';
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    wordCount?: number;
    extractionTime?: number;
    extractionMethod?: string;
    pages?: number;
    method?: string;
    warnings?: string[];
  };
}

// Check if URL is a YouTube video
export function isYouTubeUrl(url: string): boolean {
  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
  return youtubePattern.test(url);
}

// Check if URL points to a downloadable file
export function isFileUrl(url: string): boolean {
  const fileExtensions = /\.(pdf|docx?|doc|txt|rtf|odt)(\?.*)?$/i;
  return fileExtensions.test(url);
}

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function tryPublicYouTubeTranscript(videoId: string): Promise<ContentExtractionResult> {
  try {
    const watchResponse = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Vio/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!watchResponse.ok) throw new Error(`YouTube watch page returned ${watchResponse.status}`);
    const html = await watchResponse.text();
    const match = html.match(/"captionTracks":(\[[\s\S]*?\])(?:,"audioTracks"|,"videoDetails"|,"translationLanguages")/);
    if (!match) throw new Error("This video does not expose public captions");
    const tracks = JSON.parse(match[1]) as { baseUrl: string; languageCode?: string }[];
    const track = tracks.find((item) => item.languageCode?.startsWith("en")) || tracks[0];
    if (!track?.baseUrl) throw new Error("No usable caption track was found");
    const transcriptResponse = await fetch(`${track.baseUrl}&fmt=json3`, { signal: AbortSignal.timeout(15_000) });
    if (!transcriptResponse.ok) throw new Error(`YouTube captions returned ${transcriptResponse.status}`);
    const payload = await transcriptResponse.json() as { events?: { segs?: { utf8?: string }[] }[] };
    const content = (payload.events || []).flatMap((event) => event.segs || []).map((segment) => segment.utf8 || "").join(" ").replace(/\s+/g, " ").trim();
    if (!content) throw new Error("The public caption track was empty");
    const title = html.match(/<title>([\s\S]*?) - YouTube<\/title>/)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    return { success: true, content, contentType: "transcript", metadata: { title, wordCount: content.split(/\s+/).length, extractionTime: Date.now(), extractionMethod: "youtube-public-captions" } };
  } catch (error) {
    return { success: false, content: "", contentType: "transcript", error: error instanceof Error ? error.message : "YouTube captions failed" };
  }
}

// YouTube Data API v3 fallback for metadata and description. Descriptions are never labeled as transcripts.
async function tryYoutubeDataApi(videoId: string): Promise<ContentExtractionResult> {
  try {
    console.log('🎥 Using YouTube Data API v3...');
    
    if (!process.env.YOUTUBE_API_KEY) {
      console.log('❌ YouTube Data API key not configured');
      return {
        success: false,
        content: '',
        contentType: 'video-description',
        error: 'YouTube Data API key not configured'
      };
    }
    
    // Get video details
    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
    );
    
    if (!videoResponse.ok) {
      throw new Error(`YouTube Data API error: ${videoResponse.status}`);
    }
    
    const videoData = await videoResponse.json();
    
    if (!videoData.items || videoData.items.length === 0) {
      console.log('❌ YouTube Data API: Video not found');
      return {
        success: false,
        content: '',
        contentType: 'video-description',
        error: 'Video not found via YouTube Data API'
      };
    }
    
    const video = videoData.items[0];
    const title = video.snippet.title;
    const description = video.snippet.description;
    
    console.log('✅ YouTube Data API: Video metadata retrieved');
    console.log('📋 Video title:', title);
    console.log('📝 Description length:', description.length, 'characters');
    
    // Use video description as content if it's substantial
    if (description && description.length > 100) {
      console.log('✅ YouTube Data API: Using video description as content');
      return {
        success: true,
        content: description,
        contentType: 'video-description',
        metadata: {
          title: title,
          wordCount: description.split(/\s+/).length,
          extractionTime: Date.now(),
          extractionMethod: 'youtube-data-api-description'
        }
      };
    }
    
    console.log('❌ YouTube Data API: Description too short to be useful');
    return {
      success: false,
      content: '',
      contentType: 'video-description',
      error: 'Video description too short to extract meaningful content'
    };
  } catch (error) {
    console.error('❌ YouTube Data API error:', error);
    return {
      success: false,
      content: '',
      contentType: 'video-description',
      error: error instanceof Error ? error.message : 'YouTube Data API failed'
    };
  }
}

// Prefer genuine public captions; fall back to a clearly labeled description.
export async function extractYouTubeTranscript(url: string): Promise<ContentExtractionResult> {
  try {
    console.log('🎥 Starting YouTube content extraction for:', url);
    
    const videoId = extractYouTubeVideoId(url);
    console.log('🆔 Extracted video ID:', videoId);
    
    if (!videoId) {
      console.log('❌ Invalid YouTube URL - no video ID found');
      return {
        success: false,
        content: '',
        contentType: 'transcript',
        error: 'Invalid YouTube URL - could not extract video ID'
      };
    }

    console.log('🔍 Extracting content using YouTube Data API v3...');
    const transcript = await tryPublicYouTubeTranscript(videoId);
    const result = transcript.success ? transcript : await tryYoutubeDataApi(videoId);
    
    if (result.success && result.content.length > 0) {
      console.log(`✅ SUCCESS! Extracted ${result.content.length} characters`);
      console.log(`📋 Extraction method: ${result.metadata?.extractionMethod}`);
      return result;
    } else {
      console.log(`❌ Extraction failed: ${result.error}`);
      return result;
    }
    
  } catch (error) {
    console.error('❌ YouTube content extraction error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      content: '',
      contentType: 'transcript',
      error: error instanceof Error ? error.message : 'Failed to extract content'
    };
  }
}

// Extract content from PDF file
export async function extractPdfContent(buffer: Buffer): Promise<ContentExtractionResult> {
  try {
    console.log('📄 Starting enhanced PDF content extraction, buffer size:', buffer.length);
    
    // Use the enhanced PDF extractor
    const { extractPDFContent } = await import('@/lib/pdf-extractor');
    const result = await extractPDFContent(buffer);
    
    if (result.success) {
      console.log('✅ Enhanced PDF extraction successful:', {
        method: result.metadata.method,
        contentLength: result.content.length,
        wordCount: result.metadata.wordCount,
        pages: result.metadata.pages,
        processingTime: result.metadata.processingTime
      });
      
      return {
        success: true,
        content: result.content,
        contentType: 'pdf',
        metadata: {
          title: 'PDF Document',
          wordCount: result.metadata.wordCount,
          extractionTime: Date.now(),
          pages: result.metadata.pages,
          method: result.metadata.method
        }
      };
    } else {
      console.log('⚠️ Enhanced PDF extraction failed but providing detailed fallback:', {
        method: result.metadata.method,
        error: result.metadata.error,
        warnings: result.metadata.warnings
      });
      
      return {
        success: false,
        content: result.content, // Contains detailed error explanation
        contentType: 'pdf',
        error: result.metadata.error || 'PDF extraction failed',
        metadata: {
          title: 'PDF Document',
          wordCount: result.metadata.wordCount,
          extractionTime: Date.now(),
          method: result.metadata.method,
          warnings: result.metadata.warnings
        }
      };
    }
  } catch (error) {
    console.error('❌ Enhanced PDF extraction error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      content: '',
      contentType: 'pdf',
      error: error instanceof Error ? error.message : 'Failed to extract PDF content'
    };
  }
}

// Extract content from DOCX file
export async function extractDocxContent(buffer: Buffer): Promise<ContentExtractionResult> {
  try {
    console.log('📝 Starting DOCX content extraction, buffer size:', buffer.length);
    
    const result = await mammoth.extractRawText({ buffer });
    console.log('✅ DOCX parsed successfully, text length:', result.value.length);
    
    if (!result.value || result.value.trim().length === 0) {
      console.log('❌ DOCX contains no extractable text');
      return {
        success: false,
        content: '',
        contentType: 'docx',
        error: 'DOCX contains no extractable text'
      };
    }
    
    return {
      success: true,
      content: result.value,
      contentType: 'docx',
      metadata: {
        title: 'Word Document',
        wordCount: result.value.split(/\s+/).length,
        extractionTime: Date.now()
      }
    };
  } catch (error) {
    console.error('❌ DOCX extraction error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      content: '',
      contentType: 'docx',
      error: error instanceof Error ? error.message : 'Failed to extract DOCX content'
    };
  }
}

// Download file and extract content
export async function extractFileContent(url: string): Promise<ContentExtractionResult> {
  try {
    console.log('🔗 Downloading file from URL:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('📥 File downloaded, size:', buffer.length);
    
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      console.log('❌ Could not determine file type');
      return {
        success: false,
        content: '',
        contentType: 'text',
        error: 'Could not determine file type'
      };
    }

    console.log('📋 Detected file type:', fileType.mime);

    // Extract based on file type
    switch (fileType.mime) {
      case 'application/pdf':
        return await extractPdfContent(buffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractDocxContent(buffer);
      
      case 'text/plain':
        const textContent = buffer.toString('utf-8');
        return {
          success: true,
          content: textContent,
          contentType: 'text',
          metadata: {
            title: 'Text File',
            wordCount: textContent.split(/\s+/).length,
            extractionTime: Date.now()
          }
        };
      
      default:
        return {
          success: false,
          content: '',
          contentType: 'text',
          error: `Unsupported file type: ${fileType.mime}`
        };
    }
  } catch (error) {
    console.error('❌ File content extraction error:', error);
    return {
      success: false,
      content: '',
      contentType: 'text',
      error: error instanceof Error ? error.message : 'Failed to extract file content'
    };
  }
}

// Scrape website content using Firecrawl
export async function scrapeWebsiteContent(url: string): Promise<ContentExtractionResult> {
  try {
    console.log('🌐 Starting website scraping for:', url);
    
    if (!process.env.FIRECRAWL_API_KEY) {
      console.log('❌ Firecrawl API key not configured');
      return {
        success: false,
        content: '',
        contentType: 'web-content',
        error: 'Firecrawl API key not configured'
      };
    }

    console.log('🔍 Scraping website content...');
    const scrapeResponse = await firecrawl.scrapeUrl(url, {
      formats: ['markdown']
    });

    if (!scrapeResponse.success || !scrapeResponse.markdown) {
      console.log('❌ Failed to scrape website content');
      throw new Error('Failed to scrape website content');
    }

    const content = scrapeResponse.markdown || '';
    console.log('✅ Website scraped successfully, content length:', content.length);
    
    return {
      success: true,
      content,
      contentType: 'web-content',
      metadata: {
        title: scrapeResponse.metadata?.title || 'Website Content',
        description: scrapeResponse.metadata?.description,
        wordCount: content.split(/\s+/).length,
        extractionTime: Date.now()
      }
    };
  } catch (error) {
    console.error('❌ Website scraping error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      content: '',
      contentType: 'web-content',
      error: error instanceof Error ? error.message : 'Failed to scrape website content'
    };
  }
}

// Main function to extract content from any URL
export async function extractContentFromUrl(url: string): Promise<ContentExtractionResult> {
  try {
    console.log('🔍 Starting content extraction for URL:', url);
    
    // Check if it's a YouTube URL
    if (isYouTubeUrl(url)) {
      console.log('🎥 Detected YouTube URL, extracting transcript...');
      return await extractYouTubeTranscript(url);
    }
    
    // Check if it's a direct file URL
    if (isFileUrl(url)) {
      console.log('📁 Detected file URL, downloading and extracting...');
      return await extractFileContent(url);
    }
    
    // Otherwise, scrape as a website
    console.log('🌐 Detected website URL, scraping content...');
    return await scrapeWebsiteContent(url);
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return {
      success: false,
      content: '',
      contentType: 'preview',
      error: error instanceof Error ? error.message : 'Failed to extract content'
    };
  }
}
