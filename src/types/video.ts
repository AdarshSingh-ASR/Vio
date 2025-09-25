export interface VideoScript {
  title: string;
  introduction: string;
  sections?: VideoSection[];
  conclusion: string;
  quizQuestions?: QuizQuestion[];
  visualSuggestions?: VisualSuggestion[];
  estimatedDuration: number;
}

export interface VideoSection {
  title: string;
  content: string;
  examples: string[];
  visualElements: string[];
  duration: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface VisualSuggestion {
  type: 'diagram' | 'chart' | 'animation' | 'real-world-example';
  description: string;
  timing: number; // seconds into video
}

export interface VideoGenerationRequest {
  topic: string;
  selectedDocuments?: string[];
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  videoStyle: 'explainer' | 'tutorial' | 'story' | 'interactive';
  duration: number; // in minutes
  includeExamples: boolean;
  includeVisuals: boolean;
  includeQuiz: boolean;
}

export interface VideoGenerationResponse {
  success: boolean;
  videoRequest?: any;
  script?: VideoScript;
  videoUrl?: string;
  audioUrl?: string;
  previewUrl?: string;
  error?: string;
}
