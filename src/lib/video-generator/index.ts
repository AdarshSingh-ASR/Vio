import { ScriptGenerationAgent } from './script-agent';
import { VisualGenerationAgent } from './visual-agent';
import { AudioGenerator } from './audio-generator';
import { VideoRenderer } from './video-renderer';
import { VideoStorageService } from './storage-integration';
import { DocumentContextService } from './document-context';
import { VideoGenerationErrorHandler } from './error-handling';
import {
  VideoGenerationConfig,
  VideoGenerationProgress,
  VideoGenerationResult,
  VideoChunk,
  VideoScript,
  ScriptScene
} from './types';

export class EnhancedVideoGenerator {
  private scriptAgent: ScriptGenerationAgent;
  private visualAgent: VisualGenerationAgent;
  private audioGenerator: AudioGenerator;
  private videoRenderer: VideoRenderer;
  private storageService: VideoStorageService;
  private documentService: DocumentContextService;
  private config: VideoGenerationConfig;

  constructor(config: Partial<VideoGenerationConfig> = {}) {
    this.config = {
      chunkDuration: 5,
      totalDuration: 60,
      quality: 'medium',
      resolution: '1280x720',
      frameRate: 30,
      voiceSettings: {
        language: 'en',
        speed: 1.0,
        pitch: 1.0
      },
      visualSettings: {
        style: 'mixed',
        colorScheme: '3blue1brown',
        animationStyle: 'smooth'
      },
      ...config
    };

    this.scriptAgent = new ScriptGenerationAgent();
    this.visualAgent = new VisualGenerationAgent();
    this.audioGenerator = new AudioGenerator();
    this.videoRenderer = new VideoRenderer();
    this.storageService = new VideoStorageService();
    this.documentService = new DocumentContextService();
  }

  async generateVideo(
    script: VideoScript,
    progressCallback?: (progress: VideoGenerationProgress) => void,
    userId?: string,
    documentIds?: string[]
  ): Promise<VideoGenerationResult> {
    const startTime = Date.now();
    
    try {
      // Validate environment
      const envValidation = await VideoGenerationErrorHandler.validateEnvironment();
      if (!envValidation.valid) {
        console.warn('Environment validation issues:', envValidation.issues);
      }

      // Update progress
      this.updateProgress(progressCallback, 'Initializing video generation...', 0.05);

      // Step 1: Break script into chunks
      this.updateProgress(progressCallback, 'Breaking script into chunks...', 0.1);
      const chunks = this.breakScriptIntoChunks(script);
      
      this.updateProgress(progressCallback, `Created ${chunks.length} chunks`, 0.15);

      // Step 2: Process each chunk
      const videoChunks: VideoChunk[] = [];
      const audioPaths: string[] = [];
      const videoPaths: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = 0.2 + (i / chunks.length) * 0.7; // 20% to 90%

        try {
          // Generate visual code for chunk with error handling (like Python version)
          this.updateProgress(progressCallback, `🎨 Generating visuals for chunk ${i + 1}/${chunks.length}`, progress);
          const visualCode = await VideoGenerationErrorHandler.executeWithFallback(
            () => this.visualAgent.generateVisualCode({
              scriptScene: this.scriptSceneToObject(script.scenes[i % script.scenes.length]),
              topic: script.title,
              duration: chunk.duration,
              visualStyle: this.config.visualSettings.style
            }),
            `Visual generation for chunk ${i + 1}`,
            2
          );

          chunk.visualCode = visualCode.python_code;

          // Generate voiceover for chunk (like Python version)
          this.updateProgress(progressCallback, `🎤 Generating voiceover for chunk ${i + 1}`, progress + 0.02);
          const audioPath = await VideoGenerationErrorHandler.executeWithFallback(
            () => this.audioGenerator.generateAudio({
              text: chunk.text,
              language: this.config.voiceSettings.language,
              speed: this.config.voiceSettings.speed,
              pitch: this.config.voiceSettings.pitch,
              format: 'wav'
            }),
            `Audio generation for chunk ${i + 1}`,
            2
          );

          chunk.audioPath = audioPath;
          audioPaths.push(audioPath);

          // Render video chunk with error handling (like Python version)
          this.updateProgress(progressCallback, `🎬 Rendering chunk ${i + 1}`, progress + 0.04);
          const videoPath = await VideoGenerationErrorHandler.executeWithFallback(
            () => this.videoRenderer.renderVideoChunk(chunk, {
              code: visualCode.python_code,
              outputPath: '', // Will be set by renderer
              quality: this.config.quality,
              resolution: this.config.resolution,
              frameRate: this.config.frameRate
            }),
            `Video rendering for chunk ${i + 1}`,
            2
          );

          chunk.videoPath = videoPath;
          videoPaths.push(videoPath);

          videoChunks.push(chunk);

          this.updateProgress(progressCallback, `✅ Chunk ${i + 1} completed`, progress + 0.06);

        } catch (error) {
          const handledError = await VideoGenerationErrorHandler.handleError(
            error as Error, 
            `Chunk ${i + 1} processing`
          );
          
          await VideoGenerationErrorHandler.logError(handledError, userId, {
            chunkId: chunk.chunkId,
            scriptTitle: script.title
          });

          if (VideoGenerationErrorHandler.isRecoverableError(handledError)) {
            console.warn(`Chunk ${i + 1} failed but continuing with other chunks:`, handledError.message);
            // Continue with other chunks
          } else {
            throw handledError;
          }
        }
      }

      if (videoChunks.length === 0) {
        console.warn('No chunks were successfully processed, creating fallback video');
        // Create a fallback video with just the script content
        const fallbackChunk = await this.createFallbackVideo(script, progressCallback);
        videoChunks.push(fallbackChunk);
        videoPaths.push(fallbackChunk.videoPath || '');
        audioPaths.push(fallbackChunk.audioPath || '');
      }

      // Step 3: Combine all chunks with error handling
      this.updateProgress(progressCallback, '🔗 Combining all chunks into final video...', 0.95);
      
      const finalVideoPath = `temp/videos/final_${Date.now()}.mp4`;
      const combinedVideoPath = await VideoGenerationErrorHandler.executeWithFallback(
        () => this.videoRenderer.combineVideoChunks(
          videoChunks.map(chunk => ({
            videoPath: chunk.videoPath!,
            audioPath: chunk.audioPath
          })),
          finalVideoPath
        ),
        'Video combination',
        2
      );

      // Step 4: Generate preview with error handling
      this.updateProgress(progressCallback, 'Generating preview...', 0.98);
      const previewPath = `temp/videos/preview_${Date.now()}.jpg`;
      const finalPreviewPath = await VideoGenerationErrorHandler.executeWithGracefulDegradation(
        () => this.videoRenderer.generatePreview(combinedVideoPath, previewPath),
        async () => previewPath, // Fallback to empty preview
        'Preview generation'
      );

      // Step 5: Upload to storage if userId provided
      let finalVideoUrl = combinedVideoPath;
      let finalAudioUrl = audioPaths.length > 0 ? audioPaths[0] : undefined;
      let finalPreviewUrl = finalPreviewPath;

      if (userId) {
        try {
          this.updateProgress(progressCallback, 'Uploading to storage...', 0.99);
          
          finalVideoUrl = await VideoGenerationErrorHandler.executeWithGracefulDegradation(
            () => this.storageService.moveTempToStorage(
              combinedVideoPath, 
              `video_${Date.now()}.mp4`, 
              userId, 
              'video'
            ),
            () => Promise.resolve(combinedVideoPath),
            'Video storage upload'
          );

          if (finalAudioUrl) {
            finalAudioUrl = await VideoGenerationErrorHandler.executeWithGracefulDegradation(
              () => this.storageService.moveTempToStorage(
                finalAudioUrl!, 
                `audio_${Date.now()}.wav`, 
                userId, 
                'audio'
              ),
              () => Promise.resolve(finalAudioUrl!),
              'Audio storage upload'
            );
          }

          if (finalPreviewUrl) {
            finalPreviewUrl = await VideoGenerationErrorHandler.executeWithGracefulDegradation(
              () => this.storageService.moveTempToStorage(
                finalPreviewUrl!, 
                `preview_${Date.now()}.jpg`, 
                userId, 
                'image'
              ),
              () => Promise.resolve(finalPreviewUrl!),
              'Preview storage upload'
            );
          }
        } catch (error) {
          console.warn('Storage upload failed, using local paths:', error);
        }
      }

      // Step 6: Cleanup
      await this.cleanup(audioPaths, videoPaths);

      const generationTime = Date.now() - startTime;
      
      this.updateProgress(progressCallback, 'Video generation completed!', 1.0);

      return {
        success: true,
        videoUrl: finalVideoUrl,
        audioUrl: finalAudioUrl,
        previewUrl: finalPreviewUrl,
        chunks: videoChunks,
        metadata: {
          totalDuration: this.config.totalDuration,
          chunkCount: chunks.length,
          generationTime,
          fileSize: await this.getFileSize(combinedVideoPath)
        }
      };

    } catch (error) {
      const handledError = await VideoGenerationErrorHandler.handleError(
        error as Error,
        'Video generation'
      );
      
      await VideoGenerationErrorHandler.logError(handledError, userId, {
        scriptTitle: script.title,
        totalDuration: this.config.totalDuration,
        chunkDuration: this.config.chunkDuration
      });

      return {
        success: false,
        error: handledError.message,
        errorCode: handledError.code,
        recoverable: handledError.recoverable
      };
    }
  }

  private breakScriptIntoChunks(script: VideoScript): VideoChunk[] {
    // Combine all narration text like Python version
    const fullText = script.scenes.map(scene => scene.narration).join(' ');
    
    // Split into sentences (same as Python version)
    const sentences = fullText
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Calculate chunks needed (same as Python version)
    const numChunks = Math.max(1, Math.floor(this.config.totalDuration / this.config.chunkDuration));
    const sentencesPerChunk = Math.max(1, Math.floor(sentences.length / numChunks));

    const chunks: VideoChunk[] = [];

    for (let i = 0; i < numChunks; i++) {
      const startIdx = i * sentencesPerChunk;
      let endIdx = Math.min((i + 1) * sentencesPerChunk, sentences.length);
      
      // For the last chunk, include any remaining sentences (like Python version)
      if (i === numChunks - 1) {
        endIdx = sentences.length;
      }
      
      const chunkSentences = sentences.slice(startIdx, endIdx);
      const chunkText = chunkSentences.join('. ');

      // Only add non-empty chunks (like Python version)
      if (chunkText.trim()) {
        chunks.push({
          chunkId: i + 1,
          text: chunkText,
          startTime: i * this.config.chunkDuration,
          duration: this.config.chunkDuration,
          sentences: chunkSentences
        });
      }
    }

    console.log(`📊 Created ${chunks.length} chunks of ${this.config.chunkDuration}s each (like Python version)`);
    return chunks;
  }

  private scriptSceneToObject(scene: any): any {
    // Convert script scene to object format expected by visual agent
    return {
      title: scene.title || 'Scene',
      narration: scene.narration || '',
      visualDescription: scene.visualDescription || '',
      animationType: scene.animationType || 'text',
      keyConcepts: scene.keyConcepts || []
    };
  }

  private updateProgress(
    callback: ((progress: VideoGenerationProgress) => void) | undefined,
    message: string,
    progress: number
  ): void {
    if (callback) {
      callback({
        stage: this.getStageFromProgress(progress),
        message,
        progress
      });
    }
  }

  private getStageFromProgress(progress: number): string {
    if (progress < 0.1) return 'initializing';
    if (progress < 0.2) return 'chunking';
    if (progress < 0.9) return 'processing';
    if (progress < 0.95) return 'combining';
    if (progress < 1.0) return 'finalizing';
    return 'completed';
  }

  private async createFallbackVideo(script: VideoScript, progressCallback?: (progress: VideoGenerationProgress) => void): Promise<VideoChunk> {
    this.updateProgress(progressCallback, 'Creating fallback video...', 0.1);
    
    try {
      // Create a simple fallback chunk with the entire script content
      const fallbackChunk: VideoChunk = {
        chunkId: 1,
        startTime: 0,
        text: script.title + '\n\n' + script.scenes.map(s => s.narration).join('\n\n'),
        duration: script.totalDuration,
        sentences: [script.title, ...script.scenes.map(s => s.narration)],
        audioPath: '',
        videoPath: '',
        visualCode: `from manim import *

class VideoScene(Scene):
    def construct(self):
        # Simple fallback video with script content
        title = Text("${script.title.replace(/"/g, '\\"')}", font_size=36, color=BLUE)
        content = Text("${script.scenes.map(s => s.narration).join(' ').replace(/"/g, '\\"').substring(0, 200)}...", font_size=20, color=WHITE)
        content.scale_to_fit_width(10)
        
        # Show title
        self.play(Write(title), run_time=2)
        self.wait(1)
        
        # Show content
        self.play(Transform(title, content), run_time=2)
        self.wait(${script.totalDuration - 5})
        
        # Fade out
        self.play(FadeOut(content), run_time=1)`
      };

      // Generate audio for the fallback chunk
      this.updateProgress(progressCallback, 'Generating fallback audio...', 0.2);
      const audioPath = await this.audioGenerator.generateAudio({
        text: fallbackChunk.text
      });
      fallbackChunk.audioPath = audioPath;

      // Generate video for the fallback chunk
      this.updateProgress(progressCallback, 'Generating fallback video...', 0.3);
      const videoPath = await this.videoRenderer.renderVideoChunk(fallbackChunk, {
        code: fallbackChunk.visualCode || '',
        outputPath: '',
        quality: this.config.quality,
        resolution: this.config.resolution,
        frameRate: this.config.frameRate
      });
      fallbackChunk.videoPath = videoPath || '';

      this.updateProgress(progressCallback, 'Fallback video created successfully', 0.4);
      return fallbackChunk;

    } catch (error) {
      console.error('Failed to create fallback video:', error);
      throw new Error(`Fallback video creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      if (typeof window === 'undefined') {
        const { promises: fs } = await import('fs');
        const stats = await fs.stat(filePath);
        return stats.size;
      } else {
        // Client-side: return 0 as we can't get file size from blob URLs
        return 0;
      }
    } catch (error) {
      return 0;
    }
  }

  private async cleanup(audioPaths: string[], videoPaths: string[]): Promise<void> {
    try {
      await this.audioGenerator.cleanup(audioPaths);
      
      // Only cleanup video paths on server-side
      if (typeof window === 'undefined') {
        const path = await import('path');
        await this.videoRenderer.cleanup(videoPaths.map(videoPath => path.dirname(videoPath)));
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  // Legacy method for backward compatibility
  async generatePreview(script: VideoScript): Promise<string> {
    try {
      const result = await this.generateVideo(script);
      return result.previewUrl || '';
    } catch (error) {
      console.error('Preview generation failed:', error);
      return '';
    }
  }
}

// Export all components for external use
export {
  ScriptGenerationAgent,
  VisualGenerationAgent,
  AudioGenerator,
  VideoRenderer,
  VideoStorageService,
  DocumentContextService,
  VideoGenerationErrorHandler
};

// Export types
export type {
  VideoGenerationConfig,
  VideoGenerationProgress,
  VideoGenerationResult,
  VideoChunk,
  VideoScript,
  ScriptScene
};

// Export for backward compatibility
export const advancedVideoGenerator = new EnhancedVideoGenerator();
