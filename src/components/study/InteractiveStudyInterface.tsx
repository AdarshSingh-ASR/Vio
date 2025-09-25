'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Play, Pause, RotateCcw, BarChart3, BookOpen } from 'lucide-react';

interface Question {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'application';
  difficulty: 'easy' | 'medium' | 'hard';
  targetArea: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  learningObjective: string;
  sourceDocument?: string;
  sourceTitle?: string;
}

interface StudySession {
  id: string;
  title: string;
  sessionType: string;
  durationMinutes: number;
  status: string;
  questionsCount?: number;
  sessionData?: {
    adaptiveQuestions: Question[];
    currentQuestionIndex: number;
    answers: any[];
    sessionProgress: {
      totalQuestions: number;
      answeredQuestions: number;
      correctAnswers: number;
      timeSpent: number;
    };
  };
}

interface InteractiveStudyInterfaceProps {
  studySession: StudySession;
  onSessionComplete: (session: StudySession) => void;
  onClose: () => void;
  getAuthenticatedFetch: () => (url: string, options?: RequestInit) => Promise<Response>;
}

const InteractiveStudyInterface: React.FC<InteractiveStudyInterfaceProps> = ({
  studySession,
  onSessionComplete,
  onClose,
  getAuthenticatedFetch
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({
    totalQuestions: 0,
    answeredQuestions: 0,
    correctAnswers: 0,
    timeSpent: 0
  });

  const questions = studySession.sessionData?.adaptiveQuestions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Timer effect
  useEffect(() => {
    if (!isPaused && currentQuestion) {
      const timer = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPaused, currentQuestion]);

  // Initialize progress
  useEffect(() => {
    if (studySession.sessionData?.sessionProgress) {
      setSessionProgress(studySession.sessionData.sessionProgress);
      setCurrentQuestionIndex(studySession.sessionData.currentQuestionIndex || 0);
    }
  }, [studySession]);

  const handleAnswerSubmit = async () => {
    if (!currentQuestion) return;

    const answer = currentQuestion.type === 'multiple_choice' 
      ? selectedOption?.toString() || ''
      : userAnswer;

    if (!answer) return;

    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch(`/api/dashboard/study-sessions/${studySession.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer,
          timeSpent
        })
      });

      if (response.ok) {
        const data = await response.json();
        setIsCorrect(data.isCorrect);
        setShowExplanation(true);
        setIsAnswered(true);

        // Update progress
        setSessionProgress(prev => ({
          ...prev,
          answeredQuestions: prev.answeredQuestions + 1,
          correctAnswers: data.isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
          timeSpent: prev.timeSpent + timeSpent
        }));

        if (data.isSessionComplete) {
          setTimeout(() => {
            onSessionComplete(data.studySession);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer('');
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(null);
      setShowExplanation(false);
      setTimeSpent(0);
    }
  };

  const handlePauseResume = async () => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch(`/api/dashboard/study-sessions/${studySession.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isPaused ? 'resume' : 'pause'
        })
      });

      if (response.ok) {
        setIsPaused(!isPaused);
      }
    } catch (error) {
      console.error('Failed to pause/resume session:', error);
    }
  };

  const progressPercentage = sessionProgress.totalQuestions > 0 
    ? (sessionProgress.answeredQuestions / sessionProgress.totalQuestions) * 100 
    : 0;

  const accuracyPercentage = sessionProgress.answeredQuestions > 0
    ? (sessionProgress.correctAnswers / sessionProgress.answeredQuestions) * 100
    : 0;

  if (!currentQuestion) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">No Questions Available</h2>
          <p className="text-muted-foreground mb-4">This study session doesn&apos;t have any questions to study.</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <BookOpen className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{studySession.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePauseResume}
              className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">
              {sessionProgress.answeredQuestions}/{sessionProgress.totalQuestions} questions
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Accuracy: {accuracyPercentage.toFixed(1)}%</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-300px)]">
          {!isAnswered ? (
            <div className="space-y-6">
              {/* Question Header */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentQuestion.difficulty}
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  {currentQuestion.type.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                  {currentQuestion.targetArea}
                </span>
              </div>

              {/* Question Text */}
              <div className="bg-muted/30 rounded-lg p-6">
                <h3 className="text-lg font-medium text-foreground mb-4">
                  {currentQuestion.question}
                </h3>

                {/* Answer Options */}
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                      <label 
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedOption === index 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="answer"
                          value={index}
                          checked={selectedOption === index}
                          onChange={() => setSelectedOption(index)}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-foreground">
                          <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <div>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none"
                      rows={4}
                    />
                  </div>
                )}

                {currentQuestion.type === 'application' && (
                  <div>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Explain your approach and solution..."
                      className="w-full p-3 border border-border rounded-lg bg-background text-foreground resize-none"
                      rows={6}
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleAnswerSubmit}
                  disabled={currentQuestion.type === 'multiple_choice' ? selectedOption === null : !userAnswer.trim()}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Answer
                </button>
              </div>
            </div>
          ) : (
            /* Answer Feedback */
            <div className="space-y-6">
              <div className={`flex items-center gap-3 p-4 rounded-lg ${
                isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <h3 className={`font-medium ${
                    isCorrect ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isCorrect ? 'Well done!' : 'Keep learning!'}
                  </p>
                </div>
              </div>

              {showExplanation && (
                <div className="bg-muted/30 rounded-lg p-6">
                  <h4 className="font-medium text-foreground mb-3">Explanation</h4>
                  <p className="text-muted-foreground mb-4">{currentQuestion.explanation}</p>
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Learning Objective:</span> {currentQuestion.learningObjective}
                    </p>
                  </div>
                </div>
              )}

              {/* Next Question Button */}
              {currentQuestionIndex < questions.length - 1 ? (
                <div className="flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Next Question
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Session Complete!</h3>
                  <p className="text-muted-foreground mb-4">
                    You answered {sessionProgress.correctAnswers} out of {sessionProgress.answeredQuestions} questions correctly.
                  </p>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    View Results
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveStudyInterface;
