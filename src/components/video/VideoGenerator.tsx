'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Settings, 
  BookOpen, 
  Brain, 
  Lightbulb, 
  Target, 
  Clock, 
  Video,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Volume2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import InteractiveVideoPlayer from './InteractiveVideoPlayer';
import { VideoScript, VideoGenerationResponse } from '@/types/video';
// Video generation will be handled server-side via API

interface DashboardItem {
  id: string;
  title: string;
  fileType: string;
  content?: string;
}


export default function VideoGenerator() {
  const { getAuthenticatedFetch } = useAuth();
  const [topic, setTopic] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [learningLevel, setLearningLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [videoStyle, setVideoStyle] = useState<'explainer' | 'tutorial' | 'story' | 'interactive'>('explainer');
  const [duration, setDuration] = useState(5);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includeVisuals, setIncludeVisuals] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(false);
  
  const [documents, setDocuments] = useState<DashboardItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<VideoScript | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<{
    videoUrl?: string;
    audioUrl?: string;
    previewUrl?: string;
    interactiveFeatures?: string[];
  }>({});
  const [videoEffects, setVideoEffects] = useState({
    transitions: true,
    subtitles: true,
    overlays: true,
    animations: true,
    threeD: false,
    mathAnimations: true
  });
  const [interactiveOptions, setInteractiveOptions] = useState({
    pauseOnHover: true,
    clickToPause: true,
    progressBar: true,
    chapterMarkers: true,
    speedControl: true
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch user documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const authFetch = getAuthenticatedFetch();
        const response = await authFetch('/api/dashboard/items');
        
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.items || []);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchDocuments();
  }, [getAuthenticatedFetch]);

  const handleDocumentToggle = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleGenerateVideo = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic for the video');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedScript(null);

    try {
      const authFetch = getAuthenticatedFetch();
      const response = await authFetch('/api/dashboard/video-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic.trim(),
          selectedDocuments,
          learningLevel,
          videoStyle,
          duration,
          includeExamples,
          includeVisuals,
          includeQuiz
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedScript(data.script);
        
        // Preview will be generated when the actual video is created
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate video script');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      if (error instanceof Error) {
        if (error.message.includes('Rate limited')) {
          setError(error.message);
        } else if (error.message.includes('Unauthorized')) {
          setError('Please sign in again to generate video scripts.');
        } else {
          setError(`Failed to generate video script: ${error.message}`);
        }
      } else {
        setError('Failed to generate video script. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateActualVideo = async () => {
    if (!generatedScript) {
      setError('Please generate a script first');
      return;
    }

    setIsGeneratingVideo(true);
    setError(null);
    setVideoGenerationProgress('Initializing video generation...');

    try {
      console.log('Starting enhanced video generation with chunked processing...');
      
      // Convert frontend script format to video generator format
      const scriptForGenerator = {
        title: generatedScript.title,
        totalDuration: generatedScript.estimatedDuration * 60,
        targetAudience: learningLevel,
        learningObjectives: [`Understand ${topic}`, 'Apply knowledge'],
        scenes: generatedScript.sections?.map((section, index) => ({
          sceneNumber: index + 1,
          durationSeconds: section.duration * 60,
          title: section.title,
          narration: section.content,
          visualDescription: section.visualElements.join(', '),
          keyConcepts: section.examples,
          animationType: 'conceptual' as const
        })) || []
      };

      // Call the video generation API endpoint with authentication
      const authFetch = getAuthenticatedFetch();
      const response = await authFetch('/api/dashboard/video-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: scriptForGenerator,
          config: {
            chunkDuration: 5, // 5 seconds per chunk
            totalDuration: duration * 60, // Use configured duration
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
            }
          },
          documentIds: selectedDocuments
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log('Enhanced video generation result:', result);

      if (result.success && result.videoUrl) {
        setGeneratedVideo({
          videoUrl: result.videoUrl,
          audioUrl: result.audioUrl,
          previewUrl: result.previewUrl,
          interactiveFeatures: ['chunked-processing', 'professional-voiceover', 'mathematical-animations']
        });
        setVideoGenerationProgress('Enhanced video generated successfully!');
        console.log('Enhanced video generated successfully!');
      } else {
        setError(result.error || 'Enhanced video generation failed');
        setVideoGenerationProgress('');
      }
    } catch (error) {
      console.error('Enhanced video generation error:', error);
      setError(`Enhanced video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setVideoGenerationProgress('');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleDownloadVideo = () => {
    if (generatedVideo.videoUrl) {
      const link = document.createElement('a');
      link.href = generatedVideo.videoUrl;
      link.download = `${generatedScript?.title || 'video'}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAudio = () => {
    if (generatedVideo.audioUrl) {
      const link = document.createElement('a');
      link.href = generatedVideo.audioUrl;
      link.download = `${generatedScript?.title || 'audio'}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'beginner': return <BookOpen className="h-4 w-4" />;
      case 'intermediate': return <Brain className="h-4 w-4" />;
      case 'advanced': return <Target className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'explainer': return <Lightbulb className="h-4 w-4" />;
      case 'tutorial': return <Play className="h-4 w-4" />;
      case 'story': return <BookOpen className="h-4 w-4" />;
      case 'interactive': return <Brain className="h-4 w-4" />;
      default: return <Video className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
          <Video className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learning Script Studio</h1>
          <p className="text-muted-foreground">Create engaging educational video scripts with AI</p>
        </div>
      </div>

      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Video Configuration
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Create engaging educational video scripts based on your documents and topics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="topic">Video Topic</Label>
            <Input
              id="topic"
              placeholder="Enter the topic for your educational video..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Document Selection */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <Label>Select Documents for Context (Optional)</Label>
              <ScrollArea className="h-32 border rounded-md p-3">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`doc-${doc.id}`}
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => handleDocumentToggle(doc.id)}
                      />
                      <Label htmlFor={`doc-${doc.id}`} className="flex items-center gap-2 cursor-pointer">
                        <Badge variant="outline" className="text-xs">
                          {doc.fileType.toUpperCase()}
                        </Badge>
                        <span className="text-sm">{doc.title}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedDocuments.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedDocuments.length} document(s) selected for context
                </p>
              )}
            </div>
          )}

          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Learning Level</Label>
              <Select value={learningLevel} onValueChange={(value: any) => setLearningLevel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Beginner
                    </div>
                  </SelectItem>
                  <SelectItem value="intermediate">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Intermediate
                    </div>
                  </SelectItem>
                  <SelectItem value="advanced">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Advanced
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Video Style</Label>
              <Select value={videoStyle} onValueChange={(value: any) => setVideoStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="explainer">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Explainer
                    </div>
                  </SelectItem>
                  <SelectItem value="tutorial">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Tutorial
                    </div>
                  </SelectItem>
                  <SelectItem value="story">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Story
                    </div>
                  </SelectItem>
                  <SelectItem value="interactive">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Interactive
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <Label>Additional Features</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeExamples"
                  checked={includeExamples}
                  onCheckedChange={(checked) => setIncludeExamples(checked as boolean)}
                />
                <Label htmlFor="includeExamples">Include Examples</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeVisuals"
                  checked={includeVisuals}
                  onCheckedChange={(checked) => setIncludeVisuals(checked as boolean)}
                />
                <Label htmlFor="includeVisuals">Visual Elements</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeQuiz"
                  checked={includeQuiz}
                  onCheckedChange={(checked) => setIncludeQuiz(checked as boolean)}
                />
                <Label htmlFor="includeQuiz">Include Quiz</Label>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateVideo}
            disabled={isGenerating || !topic.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Video Script...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Generate Video Script
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Script Display */}
      {generatedScript && (
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Generated Video Script
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your educational video script is ready!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Script Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{generatedScript.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">~{generatedScript.estimatedDuration} min</span>
              </div>
              <div className="flex items-center gap-2">
                {getLevelIcon(learningLevel)}
                <span className="text-sm capitalize text-muted-foreground">{learningLevel}</span>
              </div>
            </div>

            {/* Introduction */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Introduction</h4>
              <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-md border border-border/30">
                {generatedScript.introduction}
              </p>
            </div>

            {/* Video Sections */}
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Video Sections</h4>
              {generatedScript.sections && generatedScript.sections.length > 0 ? generatedScript.sections.map((section, index) => (
                <div key={index} className="border border-border/50 rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-foreground">{section.title}</h5>
                    <Badge variant="outline" className="border-border/50">{section.duration} min</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{section.content}</p>
                  
                  {section.examples.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-sm font-medium mb-1">Examples:</h6>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {section.examples.map((example, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section.visualElements.length > 0 && (
                    <div>
                      <h6 className="text-sm font-medium mb-1">Visual Elements:</h6>
                      <div className="flex flex-wrap gap-1">
                        {section.visualElements.map((visual, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {visual}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No sections available</p>
              )}
            </div>

            {/* Conclusion */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Conclusion</h4>
              <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-md border border-border/30">
                {generatedScript.conclusion}
              </p>
            </div>

            {/* Quiz Questions */}
            {generatedScript.quizQuestions && generatedScript.quizQuestions.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Quiz Questions</h4>
                {generatedScript.quizQuestions.map((question, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">{question.question}</h5>
                    <div className="space-y-1 mb-3">
                      {question.options.map((option, i) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          {String.fromCharCode(65 + i)}. {option}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-green-600">Correct Answer: </span>
                      {question.correctAnswer}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium">Explanation: </span>
                      {question.explanation}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visual Suggestions */}
            {generatedScript.visualSuggestions && generatedScript.visualSuggestions.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-medium">Visual Suggestions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {generatedScript.visualSuggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {suggestion.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {suggestion.timing}s
                        </span>
                      </div>
                      <p className="text-sm">{suggestion.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-medium">Visual Suggestions</h4>
                <p className="text-sm text-muted-foreground">No visual suggestions available</p>
              </div>
            )}

            {/* Video Effects Configuration */}
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Video Effects</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(videoEffects).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setVideoEffects(prev => ({ ...prev, [key]: checked }))
                        }
                      />
                      <Label htmlFor={key} className="text-sm capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Features Configuration */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-3">Interactive Features</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(interactiveOptions).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`interactive-${key}`}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setInteractiveOptions(prev => ({ ...prev, [key]: checked }))
                        }
                      />
                      <Label htmlFor={`interactive-${key}`} className="text-sm capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Generation Controls */}
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Generate Enhanced Video</h3>
                  <p className="text-sm text-muted-foreground">
                    Create professional videos with chunked processing, mathematical animations, and professional voiceover
                  </p>
                </div>
                <Button 
                  onClick={handleGenerateActualVideo}
                  disabled={isGeneratingVideo}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {videoGenerationProgress || 'Generating Video...'}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>

              {/* Progress Indicator */}
              {isGeneratingVideo && videoGenerationProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{videoGenerationProgress}</span>
                    <span>Please wait...</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                </div>
              )}

              {/* Generated Video Display */}
              {generatedVideo.videoUrl && (
                <div className="space-y-4">
                  <InteractiveVideoPlayer
                    videoUrl={generatedVideo.videoUrl}
                    audioUrl={generatedVideo.audioUrl}
                    title={generatedScript?.title || 'Generated Video'}
                    duration={generatedScript?.estimatedDuration ? generatedScript.estimatedDuration * 60 : 0}
                    chapters={generatedScript?.sections?.map((section, index) => ({
                      title: section.title,
                      startTime: index * 60, // Approximate timing
                      endTime: (index + 1) * 60
                    })) || []}
                    interactiveFeatures={generatedVideo.interactiveFeatures || []}
                    onVideoEnd={() => console.log('Video ended')}
                    onChapterChange={(chapterIndex) => console.log('Chapter changed:', chapterIndex)}
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleDownloadVideo}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Video
                    </Button>
                    {generatedVideo.audioUrl && (
                      <Button 
                        onClick={handleDownloadAudio}
                        variant="outline"
                        size="sm"
                      >
                        <Volume2 className="h-4 w-4 mr-2" />
                        Download Audio
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Image */}
              {generatedVideo.previewUrl && !generatedVideo.videoUrl && (
                <div className="space-y-4">
                  <div className="bg-muted/20 p-4 rounded-lg border border-border/50">
                    <h4 className="font-medium mb-2">Video Preview</h4>
                    <img 
                      src={generatedVideo.previewUrl}
                      alt="Video Preview"
                      className="w-full max-w-md rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
