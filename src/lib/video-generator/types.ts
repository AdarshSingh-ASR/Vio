export interface VideoGenerationProgress {
  stage: string;
  message: string;
  progress: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface VideoGenerationConfig {
  chunkDuration: number; // seconds per chunk
  totalDuration: number; // total video duration in seconds
  quality: 'low' | 'medium' | 'high';
  resolution: string; // e.g., '1280x720'
  frameRate: number;
  voiceSettings: {
    language: string;
    speed: number;
    pitch: number;
    voice?: string;
  };
  visualSettings: {
    style: 'mathematical' | 'conceptual' | 'diagram' | 'mixed';
    colorScheme: string;
    animationStyle: 'smooth' | 'brisk' | 'minimal';
  };
}

export interface VideoChunk {
  chunkId: number;
  text: string;
  startTime: number;
  duration: number;
  sentences: string[];
  visualCode?: string;
  audioPath?: string;
  videoPath?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  audioUrl?: string;
  previewUrl?: string;
  chunks?: VideoChunk[];
  metadata?: {
    totalDuration: number;
    chunkCount: number;
    generationTime: number;
    fileSize: number;
  };
  error?: string;
  errorCode?: string;
  recoverable?: boolean;
}

export interface ScriptScene {
  sceneNumber: number;
  durationSeconds: number;
  title: string;
  narration: string;
  visualDescription: string;
  keyConcepts: string[];
  animationType: 'mathematical' | 'conceptual' | 'diagram' | 'text';
}

export interface VideoScript {
  title: string;
  totalDuration: number;
  targetAudience: string;
  learningObjectives: string[];
  scenes: ScriptScene[];
}

export interface VisualCode {
  class_name: string;
  python_code: string;
  render_command: string;
  timing_notes: string;
  dependencies: string[];
}

export interface AudioGenerationOptions {
  text: string;
  language?: string;
  speed?: number;
  pitch?: number;
  voice?: string;
  format?: 'wav' | 'mp3' | 'webm';
}

export interface VideoRenderingOptions {
  code: string;
  outputPath: string;
  quality: 'low' | 'medium' | 'high';
  resolution: string;
  frameRate: number;
}
