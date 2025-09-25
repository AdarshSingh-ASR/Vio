"use client";
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { FileText, ChevronRight, Play, Clock, CheckCircle, X, ArrowLeft } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type DashboardItem = {
  id: string;
  title?: string;
  displayName?: string;
  url?: string;
  content?: string;
  fileType?: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  topic?: string;
};

type QuizState = {
  questions: QuizQuestion[];
  currentQuestion: number;
  answers: number[];
  timeSpent: number;
  startTime: Date;
  topicAnalysis?: any;
};

const QuizPageContent = () => {
  const { getAuthenticatedFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
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
  }, [fetchItems]);

  const generateQuiz = async () => {
    if (!selectedItem) return;

    try {
      setGeneratingQuiz(true);
      setError(null);
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/quizes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          questionCount,
          type: 'quiz'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQuiz({
          questions: data.questions,
          currentQuestion: 0,
          answers: new Array(data.questions.length).fill(-1),
          timeSpent: 0,
          startTime: new Date()
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate quiz');
        console.error('Quiz generation failed:', errorData);
      }
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      setError('Failed to generate quiz. Please try again.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const selectAnswer = (answerIndex: number) => {
    if (!quiz) return;
    const newAnswers = [...quiz.answers];
    newAnswers[quiz.currentQuestion] = answerIndex;
    setQuiz({ ...quiz, answers: newAnswers });
    setSelectedAnswer(answerIndex);
  };

  const nextQuestion = () => {
    if (!quiz) return;
    if (quiz.currentQuestion < quiz.questions.length - 1) {
      setQuiz({ ...quiz, currentQuestion: quiz.currentQuestion + 1 });
      setSelectedAnswer(quiz.answers[quiz.currentQuestion + 1] !== -1 ? quiz.answers[quiz.currentQuestion + 1] : null);
    } else {
      finishQuiz();
    }
  };

  const previousQuestion = () => {
    if (!quiz) return;
    if (quiz.currentQuestion > 0) {
      setQuiz({ ...quiz, currentQuestion: quiz.currentQuestion - 1 });
      setSelectedAnswer(quiz.answers[quiz.currentQuestion - 1] !== -1 ? quiz.answers[quiz.currentQuestion - 1] : null);
    }
  };

  const finishQuiz = async () => {
    if (!quiz || !selectedItem) return;

    const timeSpent = Math.round((new Date().getTime() - quiz.startTime.getTime()) / 60000);
    const score = quiz.answers.reduce((acc, answer, index) => {
      return acc + (answer === quiz.questions[index].correctAnswer ? 1 : 0);
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
          totalQuestions: quiz.questions.length,
          timeSpent,
          type: 'quiz',
          answers: quiz.answers,
          questions: quiz.questions
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuiz(prev => prev ? { ...prev, topicAnalysis: data.topicAnalysis } : null);
      }
    } catch (error) {
      console.error('Failed to save quiz result:', error);
    }

    setShowResults(true);
  };

  const restartQuiz = () => {
    setQuiz(null);
    setSelectedItem(null);
    setSelectedAnswer(null);
    setShowResults(false);
    setQuestionCount(5);
  };

  if (showResults && quiz) {
    const score = quiz.answers.reduce((acc, answer, index) => {
      return acc + (answer === quiz.questions[index].correctAnswer ? 1 : 0);
    }, 0);
    const percentage = Math.round((score / quiz.questions.length) * 100);
    const topicAnalysis = quiz.topicAnalysis;

    return (
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        {/* Overall Results */}
        <div className="text-center space-y-4">
          <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Quiz Complete!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You scored {score} out of {quiz.questions.length} questions
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
                Insights & Suggestions
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
                  <h4 className="text-sm font-medium text-red-800 mb-2">Areas to Focus On:</h4>
                  <div className="space-y-1">
                    {topicAnalysis.weakestTopics.map((topic: any, index: number) => (
                      <div key={index} className="text-xs text-red-700 flex items-center gap-2">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-red-600">({topic.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strong Areas */}
              {topicAnalysis.strongestTopics && topicAnalysis.strongestTopics.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Strong Areas:</h4>
                  <div className="space-y-1">
                    {topicAnalysis.strongestTopics.map((topic: any, index: number) => (
                      <div key={index} className="text-xs text-green-700 flex items-center gap-2">
                        <span className="font-medium">{topic.topic}</span>
                        <span className="text-green-600">({topic.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Review Answers</h3>
          {quiz.questions.map((question, index) => (
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
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className={`text-xs p-2 rounded ${
                      optionIndex === question.correctAnswer
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : quiz.answers[index] === optionIndex
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </div>
              {question.explanation && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  <strong>Explanation:</strong> {question.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={restartQuiz} variant="outline" className="flex-1">
            Take Another Quiz
          </Button>
          <Button onClick={() => router.push('/dashboard/quizes/taken')} className="flex-1">
            View All Results
          </Button>
        </div>
      </div>
    );
  }

  if (quiz) {
    const currentQuestion = quiz.questions[quiz.currentQuestion];
    const progress = ((quiz.currentQuestion + 1) / quiz.questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {/* Quiz Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setQuiz(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Quiz
            </button>
            <div className="text-xs text-muted-foreground">
              Question {quiz.currentQuestion + 1} of {quiz.questions.length}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
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
              disabled={quiz.currentQuestion === 0}
            >
              Previous
            </Button>
            <Button
              onClick={nextQuestion}
              disabled={selectedAnswer === null}
            >
              {quiz.currentQuestion === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
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
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Create Quiz</h1>
            <p className="text-sm text-muted-foreground">
              Select content and generate questions to test your knowledge
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
            <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
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
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quiz Settings */}
      {selectedItem && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Quiz Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Number of Questions</label>
              <div className="flex gap-2 mt-2">
                {[5, 10, 15, 20].map((count) => (
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
            onClick={generateQuiz}
            disabled={generatingQuiz}
            className="w-full"
          >
            {generatingQuiz ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                Generating Quiz...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Quiz
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

const QuizPage = () => {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-lg"></div>
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32"></div>
              <div className="h-4 bg-muted rounded w-48"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-5 bg-muted rounded w-24"></div>
            <div className="space-y-2">
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <QuizPageContent />
    </Suspense>
  );
};

export default QuizPage; 