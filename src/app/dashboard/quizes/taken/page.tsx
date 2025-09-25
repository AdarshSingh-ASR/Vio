"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Calendar, Clock, RotateCcw, ChevronRight, X, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type QuizResult = {
  $id: string;
  quizId: string;
  itemName: string;
  score: number;
  totalQuestions: number;
  timeSpent: number; // in minutes
  completedAt: string;
  type: 'quiz' | 'listening';
  percentage?: number;
  topicAnalysis?: any;
  questions?: any[];
  answers?: number[];
};

const QuizesTakenPage = () => {
  const { getAuthenticatedFetch } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'quiz' | 'listening'>('all');
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchQuizResults = useCallback(async () => {
    try {
      setLoading(true);
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/quizes/results');
      if (response.ok) {
        const data = await response.json();
        // API now returns fully parsed results, no need to parse JSON fields manually
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch quiz results:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthenticatedFetch]);

  useEffect(() => {
    fetchQuizResults();
  }, [fetchQuizResults]);

  // Prevent background scrolling when modal is open and manage focus
  useEffect(() => {
    if (showDetails) {
      // Store the currently focused element
      const activeElement = document.activeElement as HTMLElement;
      
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // Prevent layout shift
      
      // Focus the modal container
      const modalContainer = document.querySelector('[data-modal="quiz-details"]') as HTMLElement;
      if (modalContainer) {
        modalContainer.focus();
      }
      
      return () => {
        // Restore body scrolling
        document.body.style.overflow = 'unset';
        document.body.style.paddingRight = '0px';
        
        // Restore focus to the previously focused element
        if (activeElement && typeof activeElement.focus === 'function') {
          activeElement.focus();
        }
      };
    }
  }, [showDetails]);

  const filteredResults = results.filter(result => 
    filter === 'all' || result.type === filter
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-green-600 bg-green-50';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const retakeQuiz = (result: QuizResult) => {
    if (result.type === 'quiz') {
      router.push(`/dashboard/quizes/quiz?retake=${result.quizId}`);
    } else {
      router.push(`/dashboard/quizes/listening?retake=${result.quizId}`);
    }
  };

  const viewDetails = (result: QuizResult) => {
    console.log('Opening quiz details for:', result);
    console.log('Questions:', result.questions);
    console.log('Answers:', result.answers);
    setSelectedResult(result);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setSelectedResult(null);
    setShowDetails(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Quiz Results</h1>
            <p className="text-sm text-muted-foreground">
              View your quiz performance and retake quizzes
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {['all', 'quiz', 'listening'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type as any)}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
              filter === type
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {type === 'all' ? 'All Results' : type === 'quiz' ? 'Text Quizzes' : 'Listening Tests'}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-sm text-muted-foreground">Loading results...</div>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-sm font-medium text-foreground">No quiz results yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Take your first quiz to see results here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((result) => (
              <div
                key={result.$id}
                className="group bg-card border border-border rounded-lg p-6 hover:bg-muted/20 transition-all cursor-pointer"
                onClick={() => viewDetails(result)}
              >
                <div className="space-y-4">
                  {/* Header with title and actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-foreground">
                        {result.itemName}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(result.completedAt)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {result.timeSpent}m
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {result.type === 'quiz' ? 'Text Quiz' : 'Listening Test'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${getScoreColor(result.score, result.totalQuestions)}`}>
                        {result.score}/{result.totalQuestions} ({result.percentage || Math.round((result.score / result.totalQuestions) * 100)}%)
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewDetails(result);
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retakeQuiz(result);
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                          title="Retake quiz"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Topic Analysis - Only show if available */}
                  {result.topicAnalysis && result.topicAnalysis.byTopic && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
                      {/* Performance by Topic */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Performance by Topic</h4>
                        <div className="space-y-2">
                          {result.topicAnalysis.byTopic.slice(0, 3).map((topic: any, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-xs text-foreground">{topic.topic}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-muted rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      topic.percentage >= 80 ? 'bg-green-500' :
                                      topic.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${topic.percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                  {topic.percentage}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Key Insights */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Insights</h4>
                        <div className="space-y-2">
                          {/* Show areas to improve */}
                          {result.topicAnalysis.weakestTopics && result.topicAnalysis.weakestTopics.length > 0 && (
                            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                              <strong>Focus on:</strong> {result.topicAnalysis.weakestTopics.slice(0, 2).map((t: any) => t.topic).join(', ')}
                            </div>
                          )}
                          {/* Show strong areas */}
                          {result.topicAnalysis.strongestTopics && result.topicAnalysis.strongestTopics.length > 0 && (
                            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                              <strong>Strong in:</strong> {result.topicAnalysis.strongestTopics.slice(0, 2).map((t: any) => t.topic).join(', ')}
                            </div>
                          )}
                          {/* Show overall insight */}
                          {result.topicAnalysis.overallInsights && result.topicAnalysis.overallInsights.length > 0 && (
                            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                              {result.topicAnalysis.overallInsights[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal backdrop - prevents interaction with background */}
      {showDetails && (
        <div 
          className="fixed inset-0 bg-transparent z-40"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Detailed Quiz Result Modal */}
      {showDetails && selectedResult && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            pointerEvents: 'auto'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetails();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeDetails();
            }
          }}
          tabIndex={-1}
          data-modal="quiz-details"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quiz-details-title"
        >
          <div 
            className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            style={{ 
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 1
            }}
            onClick={(e) => {
              // Prevent clicks inside modal from bubbling up
              e.stopPropagation();
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 id="quiz-details-title" className="text-lg font-semibold text-foreground">Quiz Result Details</h2>
                  <p className="text-sm text-muted-foreground">{selectedResult.itemName}</p>
                </div>
              </div>
              <button
                onClick={closeDetails}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{selectedResult.score}/{selectedResult.totalQuestions}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{selectedResult.percentage || Math.round((selectedResult.score / selectedResult.totalQuestions) * 100)}%</div>
                    <div className="text-xs text-muted-foreground">Percentage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{selectedResult.timeSpent}m</div>
                    <div className="text-xs text-muted-foreground">Time Taken</div>
                  </div>
                </div>

                {/* Questions and Answers */}
                {selectedResult.questions && selectedResult.questions.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Questions & Answers</h3>
                    <div className="space-y-4">
                      {selectedResult.questions.map((question, index) => {
                        const userAnswer = selectedResult.answers?.[index];
                        const isCorrect = userAnswer === question.correctAnswer;
                        
                        return (
                          <div key={index} className="border border-border rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 space-y-3">
                                {/* Question */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">Question {index + 1}</span>
                                    {question.topic && (
                                      <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                                        {question.topic}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground">{question.question}</p>
                                  
                                  {/* For listening tests, show audio text */}
                                  {selectedResult.type === 'listening' && question.audioText && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <p className="text-xs text-blue-800 italic">&ldquo;{question.audioText}&rdquo;</p>
                                    </div>
                                  )}
                                </div>

                                {/* Options */}
                                <div className="space-y-2">
                                  {question.options.map((option: string, optionIndex: number) => {
                                    const isUserChoice = userAnswer === optionIndex;
                                    const isCorrectChoice = question.correctAnswer === optionIndex;
                                    
                                    return (
                                      <div
                                        key={optionIndex}
                                        className={`p-2 rounded-lg text-sm ${
                                          isCorrectChoice
                                            ? 'bg-green-50 border border-green-200 text-green-800'
                                            : isUserChoice && !isCorrect
                                            ? 'bg-red-50 border border-red-200 text-red-800'
                                            : 'bg-muted/50 text-muted-foreground'
                                        }`}
                                      >
                                        <span className="font-medium">
                                          {String.fromCharCode(65 + optionIndex)}. 
                                        </span>
                                        {option}
                                        {isCorrectChoice && (
                                          <span className="ml-2 text-xs font-medium">✓ Correct</span>
                                        )}
                                        {isUserChoice && !isCorrect && (
                                          <span className="ml-2 text-xs font-medium">✗ Your Answer</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Explanation */}
                                {question.explanation && (
                                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-800">
                                      <strong>Explanation:</strong> {question.explanation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Questions & Answers</h3>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        No questions data available for this quiz result.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Questions: {selectedResult.questions ? selectedResult.questions.length : 'undefined'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Answers: {selectedResult.answers ? selectedResult.answers.length : 'undefined'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Topic Analysis */}
                {selectedResult.topicAnalysis && selectedResult.topicAnalysis.byTopic && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Performance Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Performance by Topic */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">By Topic</h4>
                        <div className="space-y-2">
                          {selectedResult.topicAnalysis.byTopic.map((topic: any, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm text-foreground">{topic.topic}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      topic.percentage >= 80 ? 'bg-green-500' :
                                      topic.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${topic.percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground w-10 text-right">
                                  {topic.percentage}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Insights */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Insights</h4>
                        <div className="space-y-2">
                          {selectedResult.topicAnalysis.weakestTopics && selectedResult.topicAnalysis.weakestTopics.length > 0 && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                              <strong>Areas to improve:</strong> {selectedResult.topicAnalysis.weakestTopics.map((t: any) => t.topic).join(', ')}
                            </div>
                          )}
                          {selectedResult.topicAnalysis.strongestTopics && selectedResult.topicAnalysis.strongestTopics.length > 0 && (
                            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
                              <strong>Strong areas:</strong> {selectedResult.topicAnalysis.strongestTopics.map((t: any) => t.topic).join(', ')}
                            </div>
                          )}
                          {selectedResult.topicAnalysis.overallInsights && selectedResult.topicAnalysis.overallInsights.length > 0 && (
                            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
                              {selectedResult.topicAnalysis.overallInsights[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Completed on {formatDate(selectedResult.completedAt)}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeDetails}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeDetails();
                    retakeQuiz(selectedResult);
                  }}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all"
                >
                  Retake Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizesTakenPage; 