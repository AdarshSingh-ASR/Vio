"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Play, Pause, SkipForward, SkipBack, Volume2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type DashboardItem = {
  id: string;
  title?: string;
  displayName?: string;
  url?: string;
  content?: string;
  fileType?: string;
};

type ListeningQuestion = {
  audioText: string;
  question: string;
  options: string[];
  correctAnswer: number;
  audioUrl?: string;
  topic?: string;
};

type ListeningState = {
  questions: ListeningQuestion[];
  currentQuestion: number;
  answers: number[];
  timeSpent: number;
  startTime: Date;
  isPlaying: boolean;
  currentAudio: HTMLAudioElement | null;
  topicAnalysis?: any;
};

const ListeningTestPage = () => {
  const { getAuthenticatedFetch } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [test, setTest] = useState<ListeningState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/items?workspaceId=default');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthenticatedFetch]);

  useEffect(() => {
    fetchItems();
    
    // Load speech synthesis voices
    if ('speechSynthesis' in window) {
      console.log('🔊 Speech Synthesis API available');
      
      // Voices might not be loaded immediately
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        console.log('🔊 Available voices:', voices.length, voices.map(v => ({ name: v.name, lang: v.lang })));
        
        if (voices.length === 0) {
          // Voices not loaded yet, try again
          setTimeout(loadVoices, 100);
        } else {
          // Find best English voice
          const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
          const preferredVoice = englishVoices.find(voice => 
            voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Natural')
          );
          console.log('🔊 English voices found:', englishVoices.length);
          console.log('🔊 Preferred voice:', preferredVoice?.name || 'None');
        }
      };
      
      // Listen for voices changed event
      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
      
      // Test speech synthesis capability
      const testSynthesis = () => {
        try {
          const testUtterance = new SpeechSynthesisUtterance('Test');
          testUtterance.volume = 0; // Silent test
          testUtterance.onstart = () => console.log('🔊 Speech synthesis test: PASS');
          testUtterance.onerror = (e) => console.log('🔊 Speech synthesis test: FAIL', e.error);
          speechSynthesis.speak(testUtterance);
        } catch (error) {
          console.error('🔊 Speech synthesis test error:', error);
        }
      };
      
      // Run test after a short delay to ensure voices are loaded
      setTimeout(testSynthesis, 1000);
    } else {
      console.log('🔊 Speech Synthesis API not available');
    }
  }, [fetchItems]);

  useEffect(() => {
    return () => {
      // Stop any ongoing speech synthesis
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const generateListeningTest = async () => {
    if (!selectedItem) return;

    try {
      setGeneratingTest(true);
      setError(null);
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/quizes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          questionCount,
          type: 'listening'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTest({
          questions: data.questions,
          currentQuestion: 0,
          answers: new Array(data.questions.length).fill(-1),
          timeSpent: 0,
          startTime: new Date(),
          isPlaying: false,
          currentAudio: null
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate listening test');
        console.error('Listening test generation failed:', errorData);
      }
    } catch (error) {
      console.error('Failed to generate listening test:', error);
      setError('Failed to generate listening test. Please try again.');
    } finally {
      setGeneratingTest(false);
    }
  };

  const playAudio = async (audioText: string) => {
    if (!test) return;

    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setTest({ ...test, isPlaying: true });

      // Check if browser supports Speech Synthesis
      if ('speechSynthesis' in window) {
        console.log('🔊 Using browser Speech Synthesis API');
        
        // Use browser's Speech Synthesis API
        const utterance = new SpeechSynthesisUtterance(audioText);
        utterance.rate = playbackSpeed;
        utterance.volume = 1.0;
        utterance.pitch = 1.0;
        
        // Get available voices and use a good English voice if available
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.includes('Google')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onend = () => {
          console.log('🔊 Speech synthesis completed');
          setTest(prev => prev ? { ...prev, isPlaying: false } : null);
        };

        utterance.onerror = (event) => {
          console.error('🔊 Speech synthesis error:', event.error);
          // Fallback to TTS API if speech synthesis fails
          fallbackToTTSAPI(audioText);
        };

        speechSynthesis.speak(utterance);
      } else {
        console.log('🔊 Speech Synthesis not available, using TTS API fallback');
        await fallbackToTTSAPI(audioText);
      }

    } catch (error) {
      console.error('Failed to play audio:', error);
      setTest(prev => prev ? { ...prev, isPlaying: false } : null);
      alert('Failed to play audio. Please check your internet connection.');
    }
  };

  const fallbackToTTSAPI = async (audioText: string) => {
    try {
      console.log('🔊 Attempting TTS API fallback');
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/quizes/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: audioText })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.useBrowserTTS) {
          // API is telling us to use browser TTS but it failed
          console.log('🔊 TTS API returned browser fallback');
          setTest(prev => prev ? { ...prev, isPlaying: false } : null);
          alert('Audio playback is not available. Please try using a modern browser like Chrome or Firefox with audio support enabled.');
          return;
        }
        
        // If we get audio data, handle it
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackSpeed;
        audioRef.current = audio;

        audio.onended = () => {
          console.log('🔊 TTS API audio completed');
          setTest(prev => prev ? { ...prev, isPlaying: false } : null);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          console.error('🔊 TTS API audio playback error');
          setTest(prev => prev ? { ...prev, isPlaying: false } : null);
          URL.revokeObjectURL(audioUrl);
          alert('Audio playback failed. Please try again.');
        };

        await audio.play();
      } else {
        throw new Error('TTS API failed');
      }
    } catch (error) {
      console.error('🔊 TTS API fallback failed:', error);
      setTest(prev => prev ? { ...prev, isPlaying: false } : null);
      alert('Audio generation failed. Please try again or use a different browser.');
    }
  };

  const stopAudio = () => {
    // Stop browser speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Stop HTML audio if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (test) {
      setTest({ ...test, isPlaying: false });
    }
  };

  const selectAnswer = (answerIndex: number) => {
    if (!test) return;
    const newAnswers = [...test.answers];
    newAnswers[test.currentQuestion] = answerIndex;
    setTest({ ...test, answers: newAnswers });
    setSelectedAnswer(answerIndex);
  };

  const nextQuestion = () => {
    if (!test) return;
    stopAudio();
    if (test.currentQuestion < test.questions.length - 1) {
      setTest({ ...test, currentQuestion: test.currentQuestion + 1 });
      setSelectedAnswer(test.answers[test.currentQuestion + 1] !== -1 ? test.answers[test.currentQuestion + 1] : null);
    } else {
      finishTest();
    }
  };

  const previousQuestion = () => {
    if (!test) return;
    stopAudio();
    if (test.currentQuestion > 0) {
      setTest({ ...test, currentQuestion: test.currentQuestion - 1 });
      setSelectedAnswer(test.answers[test.currentQuestion - 1] !== -1 ? test.answers[test.currentQuestion - 1] : null);
    }
  };

  const finishTest = async () => {
    if (!test || !selectedItem) return;

    stopAudio();
    const timeSpent = Math.round((new Date().getTime() - test.startTime.getTime()) / 60000);
    const score = test.answers.reduce((acc, answer, index) => {
      return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
    }, 0);

    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/quizes/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          itemName: selectedItem.displayName || selectedItem.title,
          score,
          totalQuestions: test.questions.length,
          timeSpent,
          type: 'listening',
          answers: test.answers,
          questions: test.questions
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTest(prev => prev ? { ...prev, topicAnalysis: data.topicAnalysis } : null);
      }
    } catch (error) {
      console.error('Failed to save test result:', error);
    }

    setShowResults(true);
  };

  const restartTest = () => {
    stopAudio();
    setTest(null);
    setSelectedItem(null);
    setSelectedAnswer(null);
    setShowResults(false);
    setQuestionCount(5);
  };

  if (showResults && test) {
    const score = test.answers.reduce((acc, answer, index) => {
      return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
    }, 0);
    const percentage = Math.round((score / test.questions.length) * 100);
    const topicAnalysis = test.topicAnalysis;

    return (
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Overall Results */}
        <div className="text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Listening Test Complete!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You scored {score} out of {test.questions.length} questions
            </p>
          </div>
          <div className="text-4xl font-bold text-primary">{percentage}%</div>
        </div>

        {/* Topic Analysis */}
        {topicAnalysis && topicAnalysis.byTopic && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Performance by Topic */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Performance by Topic
              </h3>
              <div className="space-y-3">
                {topicAnalysis.byTopic.map((topic: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{topic.topic}</span>
                      <span className="text-sm text-muted-foreground">
                        {topic.correct}/{topic.total} ({topic.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          topic.percentage >= 80 ? 'bg-green-500' :
                          topic.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${topic.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights & Suggestions */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Listening Skills Analysis
              </h3>
              
              {/* Overall Insights */}
              {topicAnalysis.overallInsights && (
                <div className="space-y-3">
                  {topicAnalysis.overallInsights.map((insight: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-muted-foreground">{insight}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Areas to Focus On */}
              {topicAnalysis.weakestTopics && topicAnalysis.weakestTopics.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Listening Skills to Improve:</h4>
                  <div className="space-y-1">
                    {topicAnalysis.weakestTopics.map((topic: any, index: number) => (
                      <div key={index} className="text-xs text-red-700 flex items-center gap-2">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-red-600">({topic.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2">💡 Try listening to more content in these areas to improve comprehension</p>
                </div>
              )}

              {/* Strong Areas */}
              {topicAnalysis.strongestTopics && topicAnalysis.strongestTopics.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Strong Listening Skills:</h4>
                  <div className="space-y-1">
                    {topicAnalysis.strongestTopics.map((topic: any, index: number) => (
                      <div key={index} className="text-xs text-green-700 flex items-center gap-2">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-green-600">({topic.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-600 mt-2">🎉 Excellent comprehension in these areas!</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Review Answers</h3>
          {test.questions.map((question, index) => (
            <div key={index} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium text-foreground flex-1">
                  {index + 1}. {question.question}
                </div>
                {question.topic && (
                  <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full ml-3 flex-shrink-0">
                    {question.topic}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <strong>Audio content:</strong> {question.audioText.substring(0, 100)}...
              </div>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={`text-xs p-2 rounded ${
                      optionIndex === question.correctAnswer
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : test.answers[index] === optionIndex
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={restartTest} variant="outline" className="flex-1">
            Take Another Test
          </Button>
          <Button onClick={() => router.push('/dashboard/quizes/taken')} className="flex-1">
            View All Results
          </Button>
        </div>
      </div>
    );
  }

  if (test) {
    const currentQuestion = test.questions[test.currentQuestion];
    const progress = ((test.currentQuestion + 1) / test.questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* Test Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { stopAudio(); setTest(null); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Test
            </button>
            <div className="text-xs text-muted-foreground">
              Question {test.currentQuestion + 1} of {test.questions.length}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Audio Controls */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Headphones className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Audio Content</span>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => playAudio(currentQuestion.audioText)}
              disabled={test.isPlaying}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Play className="w-4 h-4" />
              {test.isPlaying ? 'Playing...' : 'Play Audio'}
            </button>
            
            {test.isPlaying && (
              <button
                onClick={stopAudio}
                className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-3 rounded-lg hover:bg-muted/80 transition-all"
              >
                <Pause className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-xs bg-background border border-border rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>

        {/* Question */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-foreground mb-6">
              {currentQuestion.question}
            </h2>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => selectAnswer(index)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedAnswer === index
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedAnswer === index
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}>
                      {selectedAnswer === index && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              onClick={previousQuestion}
              variant="outline"
              disabled={test.currentQuestion === 0}
            >
              <SkipBack className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={nextQuestion}
              disabled={selectedAnswer === null}
            >
              {test.currentQuestion === test.questions.length - 1 ? 'Finish Test' : 'Next Question'}
              <SkipForward className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Headphones className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Listening Test</h1>
            <p className="text-sm text-muted-foreground">
              Select content and test your listening comprehension skills
            </p>
          </div>
        </div>
      </div>

      {/* Item Selection */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-foreground">Select Content</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-sm text-muted-foreground">Loading your content...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Headphones className="w-8 h-8 text-muted-foreground mx-auto" />
            <div className="text-sm text-muted-foreground">No content available</div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedItem?.id === item.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {item.displayName || item.title || 'Untitled'}
                    </div>
                    {item.url && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {new URL(item.url).hostname}
                      </div>
                    )}
                  </div>
                  <Headphones className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Test Settings */}
      {selectedItem && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Test Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Number of Questions</label>
              <div className="flex gap-2 mt-2">
                {[3, 5, 7, 10].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`px-4 py-2 text-xs rounded-lg transition-all ${
                      questionCount === count
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={generateListeningTest}
            disabled={generatingTest}
            className="w-full"
          >
            {generatingTest ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Generating Test...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Listening Test
              </>
            )}
          </Button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 text-red-600">⚠️</div>
                <div className="text-sm text-red-800">{error}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListeningTestPage; 