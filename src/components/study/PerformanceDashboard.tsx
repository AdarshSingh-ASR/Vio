'use client';
import React from 'react';
import { BarChart3, TrendingUp, Clock, Target, CheckCircle, XCircle, Award } from 'lucide-react';

interface StudySession {
  id: string;
  title: string;
  sessionType: string;
  durationMinutes: number;
  status: string;
  questionsCount?: number;
  sessionData?: {
    adaptiveQuestions: any[];
    currentQuestionIndex: number;
    answers: any[];
    sessionProgress: {
      totalQuestions: number;
      answeredQuestions: number;
      correctAnswers: number;
      timeSpent: number;
    };
  };
  startTime?: Date;
  endTime?: Date;
}

interface PerformanceDashboardProps {
  studySessions: StudySession[];
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ studySessions }) => {
  // Calculate overall statistics
  const totalSessions = studySessions.length;
  const completedSessions = studySessions.filter(s => s.status === 'completed').length;
  const totalQuestions = studySessions.reduce((sum, s) => sum + (s.questionsCount || 0), 0);
  const totalCorrectAnswers = studySessions.reduce((sum, s) => 
    sum + (s.sessionData?.sessionProgress?.correctAnswers || 0), 0);
  const totalAnsweredQuestions = studySessions.reduce((sum, s) => 
    sum + (s.sessionData?.sessionProgress?.answeredQuestions || 0), 0);
  const totalTimeSpent = studySessions.reduce((sum, s) => 
    sum + (s.sessionData?.sessionProgress?.timeSpent || 0), 0);

  const overallAccuracy = totalAnsweredQuestions > 0 ? (totalCorrectAnswers / totalAnsweredQuestions) * 100 : 0;
  const averageSessionTime = completedSessions > 0 ? totalTimeSpent / completedSessions / 60 : 0;

  // Get recent sessions for trend analysis
  const recentSessions = studySessions
    .filter(s => s.status === 'completed')
    .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())
    .slice(0, 5);

  // Calculate improvement trends
  const getImprovementTrend = () => {
    if (recentSessions.length < 2) return 'stable';
    const recent = recentSessions.slice(0, 3);
    const older = recentSessions.slice(3, 5);
    
    const recentAvg = recent.reduce((sum, s) => {
      const accuracy = (s.sessionData?.sessionProgress?.answeredQuestions || 0) > 0
        ? ((s.sessionData?.sessionProgress?.correctAnswers || 0) / (s.sessionData?.sessionProgress?.answeredQuestions || 1)) * 100
        : 0;
      return sum + accuracy;
    }, 0) / recent.length;

    const olderAvg = older.length > 0 ? older.reduce((sum, s) => {
      const accuracy = (s.sessionData?.sessionProgress?.answeredQuestions || 0) > 0
        ? ((s.sessionData?.sessionProgress?.correctAnswers || 0) / (s.sessionData?.sessionProgress?.answeredQuestions || 1)) * 100
        : 0;
      return sum + accuracy;
    }, 0) / older.length : recentAvg;

    if (recentAvg > olderAvg + 5) return 'improving';
    if (recentAvg < olderAvg - 5) return 'declining';
    return 'stable';
  };

  const improvementTrend = getImprovementTrend();

  // Get strengths and weaknesses
  const getStrengthsAndWeaknesses = () => {
    const difficultyStats = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };

    studySessions.forEach(session => {
      const questions = session.sessionData?.adaptiveQuestions || [];
      const answers = session.sessionData?.answers || [];
      
      questions.forEach(question => {
        const answer = answers.find(a => a.questionId === question.id);
        if (answer) {
          difficultyStats[question.difficulty as keyof typeof difficultyStats].total++;
          if (answer.isCorrect) {
            difficultyStats[question.difficulty as keyof typeof difficultyStats].correct++;
          }
        }
      });
    });

    const strengths: { difficulty: string; accuracy: number }[] = [];
    const weaknesses: { difficulty: string; accuracy: number }[] = [];

    Object.entries(difficultyStats).forEach(([difficulty, stats]) => {
      const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      if (accuracy >= 80) {
        strengths.push({ difficulty, accuracy });
      } else if (accuracy < 60) {
        weaknesses.push({ difficulty, accuracy });
      }
    });

    return { strengths, weaknesses };
  };

  const { strengths, weaknesses } = getStrengthsAndWeaknesses();

  return (
    <div className="space-y-6">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-semibold text-foreground">{totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-semibold text-foreground">
                {totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Accuracy</p>
              <p className="text-2xl font-semibold text-foreground">{overallAccuracy.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Session Time</p>
              <p className="text-2xl font-semibold text-foreground">{averageSessionTime.toFixed(1)}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Performance */}
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Recent Performance</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              improvementTrend === 'improving' ? 'bg-green-100 text-green-800' :
              improvementTrend === 'declining' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {improvementTrend}
            </span>
          </div>
          
          <div className="space-y-3">
            {recentSessions.map((session, index) => {
              const sessionProgress = session.sessionData?.sessionProgress;
              const accuracy = sessionProgress && sessionProgress.answeredQuestions > 0
                ? (sessionProgress.correctAnswers / sessionProgress.answeredQuestions) * 100
                : 0;
              
              return (
                <div key={session.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{session.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {sessionProgress?.answeredQuestions || 0} questions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{accuracy.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">
                      {sessionProgress?.correctAnswers || 0}/
                      {sessionProgress?.answeredQuestions || 0}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="bg-card rounded-lg p-6 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Strengths & Weaknesses</h3>
          </div>
          
          <div className="space-y-4">
            {/* Strengths */}
            {strengths.length > 0 && (
              <div>
                <h4 className="font-medium text-green-800 mb-2">Strengths</h4>
                <div className="space-y-2">
                  {strengths.map((strength, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <span className="capitalize font-medium text-green-800">{strength.difficulty}</span>
                      <span className="text-green-600 font-semibold">{strength.accuracy.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {weaknesses.length > 0 && (
              <div>
                <h4 className="font-medium text-red-800 mb-2">Areas for Improvement</h4>
                <div className="space-y-2">
                  {weaknesses.map((weakness, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <span className="capitalize font-medium text-red-800">{weakness.difficulty}</span>
                      <span className="text-red-600 font-semibold">{weakness.accuracy.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{totalQuestions}</p>
            <p className="text-sm text-muted-foreground">Total Questions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{totalAnsweredQuestions}</p>
            <p className="text-sm text-muted-foreground">Questions Answered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{totalCorrectAnswers}</p>
            <p className="text-sm text-muted-foreground">Correct Answers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{Math.round(totalTimeSpent / 60)}</p>
            <p className="text-sm text-muted-foreground">Minutes Studied</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
