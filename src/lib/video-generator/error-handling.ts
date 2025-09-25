export interface VideoGenerationError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  fallback?: () => Promise<any>;
}

export class VideoGenerationErrorHandler {
  private static readonly ERROR_CODES = {
    SCRIPT_GENERATION_FAILED: 'SCRIPT_GENERATION_FAILED',
    VISUAL_GENERATION_FAILED: 'VISUAL_GENERATION_FAILED',
    AUDIO_GENERATION_FAILED: 'AUDIO_GENERATION_FAILED',
    VIDEO_RENDERING_FAILED: 'VIDEO_RENDERING_FAILED',
    STORAGE_UPLOAD_FAILED: 'STORAGE_UPLOAD_FAILED',
    DOCUMENT_CONTEXT_FAILED: 'DOCUMENT_CONTEXT_FAILED',
    API_RATE_LIMIT: 'API_RATE_LIMIT',
    INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  static createError(code: string, message: string, details?: any, recoverable: boolean = false): VideoGenerationError {
    return {
      code,
      message,
      details,
      recoverable,
      fallback: recoverable ? this.getFallbackForError(code) : undefined
    };
  }

  private static getFallbackForError(code: string): (() => Promise<any>) | undefined {
    switch (code) {
      case this.ERROR_CODES.SCRIPT_GENERATION_FAILED:
        return async () => this.generateFallbackScript();
      
      case this.ERROR_CODES.VISUAL_GENERATION_FAILED:
        return async () => this.generateFallbackVisual();
      
      case this.ERROR_CODES.AUDIO_GENERATION_FAILED:
        return async () => this.generateFallbackAudio();
      
      case this.ERROR_CODES.VIDEO_RENDERING_FAILED:
        return async () => this.generateFallbackVideo();
      
      case this.ERROR_CODES.STORAGE_UPLOAD_FAILED:
        return async () => this.useLocalStorage();
      
      case this.ERROR_CODES.DOCUMENT_CONTEXT_FAILED:
        return async () => this.useGenericContext();
      
      default:
        return undefined;
    }
  }

  static async handleError(error: Error, context: string): Promise<VideoGenerationError> {
    console.error(`Video generation error in ${context}:`, error);

    // Determine error type and create appropriate error object
    if (error.message.includes('rate limit') || error.message.includes('quota')) {
      return this.createError(
        this.ERROR_CODES.API_RATE_LIMIT,
        'API rate limit exceeded. Please try again later.',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('script') || error.message.includes('Script')) {
      return this.createError(
        this.ERROR_CODES.SCRIPT_GENERATION_FAILED,
        'Failed to generate video script',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('visual') || error.message.includes('Visual') || error.message.includes('Manim')) {
      return this.createError(
        this.ERROR_CODES.VISUAL_GENERATION_FAILED,
        'Failed to generate visual animations',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('audio') || error.message.includes('Audio') || error.message.includes('TTS')) {
      return this.createError(
        this.ERROR_CODES.AUDIO_GENERATION_FAILED,
        'Failed to generate audio',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('video') || error.message.includes('Video') || error.message.includes('FFmpeg')) {
      return this.createError(
        this.ERROR_CODES.VIDEO_RENDERING_FAILED,
        'Failed to render video',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('storage') || error.message.includes('upload') || error.message.includes('Storage')) {
      return this.createError(
        this.ERROR_CODES.STORAGE_UPLOAD_FAILED,
        'Failed to upload to storage',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('document') || error.message.includes('Document') || error.message.includes('context')) {
      return this.createError(
        this.ERROR_CODES.DOCUMENT_CONTEXT_FAILED,
        'Failed to process document context',
        { originalError: error.message },
        true
      );
    }

    if (error.message.includes('memory') || error.message.includes('Memory') || error.message.includes('resources')) {
      return this.createError(
        this.ERROR_CODES.INSUFFICIENT_RESOURCES,
        'Insufficient system resources',
        { originalError: error.message },
        false
      );
    }

    // Default unknown error
    return this.createError(
      this.ERROR_CODES.UNKNOWN_ERROR,
      'An unexpected error occurred during video generation',
      { originalError: error.message },
      false
    );
  }

  static async executeWithFallback<T>(
    operation: () => Promise<T>,
    errorContext: string,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: VideoGenerationError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = await this.handleError(error as Error, errorContext);
        
        if (!lastError.recoverable || attempt === maxRetries) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`Retrying ${errorContext} (attempt ${attempt + 1}/${maxRetries + 1})`);
      }
    }

    throw lastError || this.createError(
      this.ERROR_CODES.UNKNOWN_ERROR,
      'Operation failed after all retry attempts',
      { attempts: maxRetries + 1 }
    );
  }

  static async executeWithGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    errorContext: string
  ): Promise<T> {
    try {
      return await this.executeWithFallback(primaryOperation, errorContext, 1);
    } catch (error) {
      console.warn(`Primary operation failed for ${errorContext}, trying fallback:`, error);
      
      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        console.error(`Fallback operation also failed for ${errorContext}:`, fallbackError);
        throw error; // Throw original error
      }
    }
  }

  // Fallback implementations
  private static async generateFallbackScript(): Promise<any> {
    return {
      title: 'Educational Video',
      totalDuration: 60,
      targetAudience: 'General audience',
      learningObjectives: ['Understand the topic', 'Apply knowledge'],
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 60,
          title: 'Introduction',
          narration: 'Welcome to this educational video. We will explore the topic in detail.',
          visualDescription: 'Simple text animation',
          keyConcepts: ['Introduction'],
          animationType: 'text'
        }
      ]
    };
  }

  private static async generateFallbackVisual(): Promise<any> {
    return {
      class_name: 'VideoScene',
      python_code: `from manim import *

class VideoScene(Scene):
    def construct(self):
        title = Text("Educational Content", font_size=40, color=BLUE)
        self.play(Write(title), run_time=2)
        self.wait(3)
        self.play(FadeOut(title), run_time=1)`,
      render_command: 'manim -pql VideoScene.py VideoScene',
      timing_notes: 'Simple fallback animation',
      dependencies: []
    };
  }

  private static async generateFallbackAudio(): Promise<string> {
    // Return path to a silent audio file or generate a simple tone
    return 'temp/audio/fallback_silence.wav';
  }

  private static async generateFallbackVideo(): Promise<string> {
    // Return path to a simple static video
    return 'temp/videos/fallback_static.mp4';
  }

  private static async useLocalStorage(): Promise<string> {
    // Use local file system instead of cloud storage
    return 'local://temp/storage';
  }

  private static async useGenericContext(): Promise<string> {
    return 'Generic educational content context';
  }

  static isRecoverableError(error: VideoGenerationError): boolean {
    return error.recoverable;
  }

  static getErrorMessage(error: VideoGenerationError): string {
    return error.message;
  }

  static getErrorCode(error: VideoGenerationError): string {
    return error.code;
  }

  static async logError(error: VideoGenerationError, userId?: string, context?: any): Promise<void> {
    try {
      // Log to your monitoring service
      console.error('Video Generation Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        recoverable: error.recoverable,
        userId,
        context,
        timestamp: new Date().toISOString()
      });

      // You could also send to external monitoring services like Sentry, LogRocket, etc.
      // await sendToMonitoringService(error, userId, context);

    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  static async validateEnvironment(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check required environment variables
      const requiredEnvVars = [
        'GROQ_API_KEY',
        'OPENAI_API_KEY',
        'APPWRITE_ENDPOINT',
        'APPWRITE_PROJECT_ID'
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          issues.push(`Missing environment variable: ${envVar}`);
        }
      }

      // Check if FFmpeg is available (for video processing) - server-side only
      if (typeof window === 'undefined') {
        try {
          const { spawn } = await import('child_process');
          // Use environment variable if available, otherwise try system PATH
          const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
          const ffmpegProcess = spawn(ffmpegPath, ['-version'], { stdio: 'pipe' });
          
          await new Promise((resolve, reject) => {
            ffmpegProcess.on('close', (code) => {
              if (code !== 0) {
                issues.push('FFmpeg is not properly installed or configured');
              }
              resolve(code);
            });
            ffmpegProcess.on('error', (error: any) => {
              if (error.code === 'ENOENT') {
                issues.push('FFmpeg is not available - video processing will use fallback methods');
              } else {
                issues.push(`FFmpeg error: ${error.message}`);
              }
              resolve(-1);
            });
          });
        } catch (error) {
          issues.push('FFmpeg is not available - video processing will use fallback methods');
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      issues.push(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        issues
      };
    }
  }
}
