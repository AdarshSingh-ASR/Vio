'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Brain, BookOpen, Search, Target, Zap, ArrowRight, Clock, TrendingUp, Users, FileText, CheckCircle, AlertCircle, Check, BarChart3, Trash2 } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from 'next/navigation';
import InteractiveStudyInterface from '@/components/study/InteractiveStudyInterface';
import PerformanceDashboard from '@/components/study/PerformanceDashboard';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  subjectArea: string;
  difficultyLevel: string;
  estimatedDuration: number;
  progressPercentage: number;
  status: string;
  learningSteps: LearningStep[];
}

interface LearningStep {
  id: string;
  stepOrder: number;
  stepType: string;
  title: string;
  estimatedDuration: number;
  status: string;
  isCompleted: boolean;
  completedAt?: Date;
}

interface ResearchQuery {
  id: string;
  queryText: string;
  queryType: string;
  confidenceScore: number;
  processingStatus?: string;
  findings: any[];
  relatedTopics: any[];
  followUpQuestions?: any[];
  sourceDocuments?: any[];
  synthesis?: any;
}

interface StudySession {
  id: string;
  title: string;
  sessionType: string;
  durationMinutes: number;
  status: string;
  questionsCount?: number;
  knowledgeAssessment?: any;
  adaptiveQuestions?: any[];
  contentSelection?: any;
  difficultyProgression?: any;
  performanceMetrics?: any;
  adaptiveFeedback?: any;
  startTime?: Date;
  endTime?: Date;
}

const AIAgentsPageContent = () => {
  const { getAuthenticatedFetch } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'learning-path' | 'research' | 'study-session'>('learning-path');
  const [loading, setLoading] = useState(false);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [researchQueries, setResearchQueries] = useState<ResearchQuery[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [selectedStudySession, setSelectedStudySession] = useState<StudySession | null>(null);
  const [showStudySessionModal, setShowStudySessionModal] = useState(false);
  const [showInteractiveStudy, setShowInteractiveStudy] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  // Sync activeTab with URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['learning-path', 'research', 'study-session'].includes(tab)) {
      setActiveTab(tab as 'learning-path' | 'research' | 'study-session');
    }
  }, []);

  // Handle tab change with URL update
  const handleTabChange = (tab: 'learning-path' | 'research' | 'study-session') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'learning-path') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    router.push(url.pathname + url.search, { scroll: false });
  };

  // Fetch study sessions
  const fetchStudySessions = useCallback(async () => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/study-sessions');
      if (response.ok) {
        const data = await response.json();
        setStudySessions(data.studySessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch study sessions:', error);
    }
  }, [getAuthenticatedFetch]);

  // Study Session handlers
  const handleStudySessionClick = async (session: StudySession) => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch(`/api/dashboard/study-sessions/${session.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedStudySession(data.studySession);
        setShowStudySessionModal(true);
      } else {
        console.error('Failed to fetch study session details');
      }
    } catch (error) {
      console.error('Error fetching study session details:', error);
    }
  };

  const closeStudySessionModal = () => {
    setShowStudySessionModal(false);
    setSelectedStudySession(null);
  };

  const startStudySession = async (session: StudySession) => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch(`/api/dashboard/study-sessions/${session.id}/start`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedStudySession(data.studySession);
        setShowInteractiveStudy(true);
        setShowStudySessionModal(false);
      } else {
        console.error('Failed to start study session');
        alert('Failed to start study session');
      }
    } catch (error) {
      console.error('Error starting study session:', error);
      alert('Error starting study session');
    }
  };

  const handleSessionComplete = (completedSession: StudySession) => {
    setShowInteractiveStudy(false);
    setSelectedStudySession(null);
    // Refresh the study sessions list
    fetchStudySessions();
    alert(`Study session completed! You answered ${(completedSession as any).sessionData?.sessionProgress?.correctAnswers || 0} out of ${(completedSession as any).sessionData?.sessionProgress?.answeredQuestions || 0} questions correctly.`);
  };

  const closeInteractiveStudy = () => {
    setShowInteractiveStudy(false);
    setSelectedStudySession(null);
  };

  // Learning Path Generator State
  const [learningPathForm, setLearningPathForm] = useState({
    subjectArea: '',
    difficultyLevel: 'beginner',
    learningObjectives: '',
    selectedDocuments: [] as string[]
  });

  // Research Assistant State
  const [researchForm, setResearchForm] = useState({
    queryText: '',
    queryType: 'search',
    searchScope: 'all',
    selectedDocuments: [] as string[]
  });

  // Study Session Orchestrator State
  const [studySessionForm, setStudySessionForm] = useState({
    sessionType: 'adaptive',
    duration: 30,
    focusAreas: [] as string[],
    difficultyPreference: 'auto'
  });

  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedLearningPath, setSelectedLearningPath] = useState<LearningPath | null>(null);
  const [showLearningPathModal, setShowLearningPathModal] = useState(false);
  const [selectedResearchQuery, setSelectedResearchQuery] = useState<ResearchQuery | null>(null);
  const [showResearchModal, setShowResearchModal] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/items?workspaceId=default');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  }, [getAuthenticatedFetch]);

  const fetchLearningPaths = useCallback(async () => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/learning-paths?workspaceId=default');
      if (response.ok) {
        const data = await response.json();
        const paths = data.learningPaths || [];
        
        // Fetch steps for each learning path
        const pathsWithSteps = await Promise.all(
          paths.map(async (path: LearningPath) => {
            try {
              const stepsResponse = await authenticatedFetch(`/api/dashboard/learning-paths/${path.id}/steps`);
              if (stepsResponse.ok) {
                const stepsData = await stepsResponse.json();
                return {
                  ...path,
                  learningSteps: stepsData.learningSteps || []
                };
              }
            } catch (error) {
              console.error(`Failed to fetch steps for path ${path.id}:`, error);
            }
            return {
              ...path,
              learningSteps: []
            };
          })
        );
        
        setLearningPaths(pathsWithSteps);
      }
    } catch (error) {
      console.error('Failed to fetch learning paths:', error);
    }
  }, [getAuthenticatedFetch]);

  const fetchResearchQueries = useCallback(async () => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/research-queries?workspaceId=default');
      if (response.ok) {
        const data = await response.json();
        setResearchQueries(data.researchQueries || []);
      }
    } catch (error) {
      console.error('Failed to fetch research queries:', error);
    }
  }, [getAuthenticatedFetch]);

  useEffect(() => {
    fetchDocuments();
    fetchLearningPaths();
    fetchResearchQueries();
    fetchStudySessions();
  }, [fetchDocuments, fetchLearningPaths, fetchResearchQueries, fetchStudySessions]);

  const generateLearningPath = async () => {
    if (!learningPathForm.subjectArea) {
      alert('Please enter a subject area');
      return;
    }

    setLoading(true);
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/learning-paths/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectArea: learningPathForm.subjectArea,
          difficultyLevel: learningPathForm.difficultyLevel,
          learningObjectives: learningPathForm.learningObjectives,
          documentIds: learningPathForm.selectedDocuments
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Learning path "${data.learningPath.title}" created successfully!`);
        setLearningPathForm({
          subjectArea: '',
          difficultyLevel: 'beginner',
          learningObjectives: '',
          selectedDocuments: []
        });
        // Refresh the learning paths list
        await fetchLearningPaths();
      } else {
        const error = await response.json();
        alert(`Failed to generate learning path: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to generate learning path:', error);
      alert('Failed to generate learning path');
    } finally {
      setLoading(false);
    }
  };

  const runResearchQuery = async () => {
    if (!researchForm.queryText) {
      alert('Please enter a research query');
      return;
    }

    setLoading(true);
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/research/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: researchForm.queryText,
          queryType: researchForm.queryType,
          searchScope: researchForm.searchScope,
          documentIds: researchForm.selectedDocuments
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create a complete research query object with all the data
        const completeResearchQuery = {
          ...data.researchQuery,
          findings: data.findings || [],
          relatedTopics: data.relatedTopics || [],
          followUpQuestions: data.followUpQuestions || [],
          sourceDocuments: data.sourceDocuments || [],
          synthesis: data.synthesis || null
        };
        
        alert(`Research completed with ${Math.round(data.researchQuery.confidenceScore * 100)}% confidence!`);
        setResearchForm({
          queryText: '',
          queryType: 'search',
          searchScope: 'all',
          selectedDocuments: []
        });
        // Refresh the research queries list
        await fetchResearchQueries();
      } else {
        const error = await response.json();
        alert(`Failed to run research query: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to run research query:', error);
      alert('Failed to run research query');
    } finally {
      setLoading(false);
    }
  };

  const orchestrateStudySession = async () => {
    setLoading(true);
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch('/api/dashboard/study-sessions/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: studySessionForm.sessionType,
          duration: studySessionForm.duration,
          focusAreas: studySessionForm.focusAreas,
          difficultyPreference: studySessionForm.difficultyPreference
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh the study sessions list from server
        await fetchStudySessions();
        alert(`Adaptive study session "${data.studySession.title}" created successfully!`);
        setStudySessionForm({
          sessionType: 'adaptive',
          duration: 30,
          focusAreas: [],
          difficultyPreference: 'auto'
        });
      } else {
        const error = await response.json();
        alert(`Failed to orchestrate study session: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to orchestrate study session:', error);
      alert('Failed to orchestrate study session');
    } finally {
      setLoading(false);
    }
  };

  const handleLearningPathClick = (path: LearningPath) => {
    setSelectedLearningPath(path);
    setShowLearningPathModal(true);
  };

  // Handle learning path delete
  const handleLearningPathDelete = async (pathId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    if (confirm('Are you sure you want to delete this learning path? This action cannot be undone.')) {
      try {
        const authenticatedFetch = getAuthenticatedFetch();
        const response = await authenticatedFetch(`/api/dashboard/learning-paths/${pathId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Remove the learning path from the local state
          setLearningPaths(prev => prev.filter(path => path.id !== pathId));
        } else {
          console.error('Failed to delete learning path');
        }
      } catch (error) {
        console.error('Error deleting learning path:', error);
      }
    }
  };

  // Handle research query delete
  const handleResearchQueryDelete = async (queryId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    if (confirm('Are you sure you want to delete this research query? This action cannot be undone.')) {
      try {
        const authenticatedFetch = getAuthenticatedFetch();
        const response = await authenticatedFetch(`/api/dashboard/research-queries/${queryId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Remove the research query from the local state
          setResearchQueries(prev => prev.filter(query => query.id !== queryId));
        } else {
          console.error('Failed to delete research query');
        }
      } catch (error) {
        console.error('Error deleting research query:', error);
      }
    }
  };

  // Handle study session delete
  const handleStudySessionDelete = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    if (confirm('Are you sure you want to delete this study session? This action cannot be undone.')) {
      try {
        const authenticatedFetch = getAuthenticatedFetch();
        const response = await authenticatedFetch(`/api/dashboard/study-sessions/${sessionId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Remove the study session from the local state
          setStudySessions(prev => prev.filter(session => session.id !== sessionId));
        } else {
          console.error('Failed to delete study session');
        }
      } catch (error) {
        console.error('Error deleting study session:', error);
      }
    }
  };

  const closeLearningPathModal = () => {
    setShowLearningPathModal(false);
    setSelectedLearningPath(null);
  };

  const handleResearchQueryClick = (query: ResearchQuery) => {
    setSelectedResearchQuery(query);
    setShowResearchModal(true);
  };

  const closeResearchModal = () => {
    setShowResearchModal(false);
    setSelectedResearchQuery(null);
  };

  const toggleStepCompletion = async (stepId: string, isCompleted: boolean) => {
    try {
      const authenticatedFetch = getAuthenticatedFetch();
      const response = await authenticatedFetch(`/api/dashboard/learning-steps/${stepId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected learning path with new progress
        if (selectedLearningPath) {
          const updatedSteps = selectedLearningPath.learningSteps.map(step => 
            step.id === stepId 
              ? { ...step, isCompleted, completedAt: isCompleted ? new Date() : undefined }
              : step
          );
          
          setSelectedLearningPath({
            ...selectedLearningPath,
            learningSteps: updatedSteps,
            progressPercentage: data.progressPercentage
          });
        }

        // Update the learning paths list with new progress
        setLearningPaths(prevPaths => 
          prevPaths.map(path => 
            path.id === selectedLearningPath?.id
              ? { ...path, progressPercentage: data.progressPercentage }
              : path
          )
        );
      } else {
        const error = await response.json();
        console.error('Failed to update step completion:', error);
      }
    } catch (error) {
      console.error('Failed to update step completion:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
          </div>
          <p className="text-muted-foreground">
            Multi-step AI agents that orchestrate complex learning workflows
          </p>
        </div>

        {/* Agent Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border">
          {[
            { id: 'learning-path', label: 'Learning Path Generator', icon: BookOpen },
            { id: 'research', label: 'Research Assistant', icon: Search },
            { id: 'study-session', label: 'Study Session Orchestrator', icon: Target }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id as any)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Learning Path Generator */}
        {activeTab === 'learning-path' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Learning Path Generator</h2>
                  <p className="text-sm text-muted-foreground">Analyzes documents and creates personalized study sequences</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Subject Area</label>
                  <input
                    type="text"
                    value={learningPathForm.subjectArea}
                    onChange={(e) => setLearningPathForm(prev => ({ ...prev, subjectArea: e.target.value }))}
                    placeholder="e.g., Machine Learning, Business Strategy"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Difficulty Level</label>
                  <select
                    value={learningPathForm.difficultyLevel}
                    onChange={(e) => setLearningPathForm(prev => ({ ...prev, difficultyLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Learning Objectives</label>
                  <textarea
                    value={learningPathForm.learningObjectives}
                    onChange={(e) => setLearningPathForm(prev => ({ ...prev, learningObjectives: e.target.value }))}
                    placeholder="What do you want to learn?"
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                <button
                  onClick={generateLearningPath}
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Zap className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Generate Learning Path
                </button>
              </div>
            </div>

            {/* Learning Paths List */}
            <div className="bg-card rounded-lg p-6 border border-border flex flex-col h-full">
              <h3 className="text-lg font-semibold text-foreground mb-4">Generated Learning Paths</h3>
              {learningPaths.length === 0 ? (
                <p className="text-muted-foreground">No learning paths generated yet</p>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-96 space-y-3 pr-2">
                  {learningPaths.map((path) => (
                    <div 
                      key={path.id} 
                      className="group relative p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleLearningPathClick(path)}
                    >
                      {/* Delete Button - Shows on Hover */}
                      <button
                        onClick={(e) => handleLearningPathDelete(path.id, e)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full hover:bg-destructive/10 text-destructive hover:text-destructive-foreground"
                        title="Delete learning path"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-center justify-between mb-2 pr-8">
                        <h4 className="font-medium text-foreground">{path.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          path.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {path.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{path.description}</p>
                      
                      {/* Progress Bar for Card */}
                      <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${path.progressPercentage}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {path.estimatedDuration} min
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {path.progressPercentage}% complete
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {path.learningSteps?.length || 0} steps
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Research Assistant */}
        {activeTab === 'research' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Research Assistant</h2>
                  <p className="text-sm text-muted-foreground">Cross-document search with intelligent analysis</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Research Query</label>
                  <textarea
                    value={researchForm.queryText}
                    onChange={(e) => setResearchForm(prev => ({ ...prev, queryText: e.target.value }))}
                    placeholder="What would you like to research?"
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Query Type</label>
                  <select
                    value={researchForm.queryType}
                    onChange={(e) => setResearchForm(prev => ({ ...prev, queryType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="search">Search</option>
                    <option value="analysis">Analysis</option>
                    <option value="synthesis">Synthesis</option>
                    <option value="exploration">Exploration</option>
                  </select>
                </div>

                <button
                  onClick={runResearchQuery}
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Zap className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Run Research Query
                </button>
              </div>
            </div>

            {/* Research Results */}
            <div className="bg-card rounded-lg p-6 border border-border flex flex-col h-full">
              <h3 className="text-lg font-semibold text-foreground mb-4">Research Results</h3>
              {researchQueries.length === 0 ? (
                <p className="text-muted-foreground">No research queries run yet</p>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-96 space-y-3 pr-2">
                  {researchQueries.map((query) => (
                    <div 
                      key={query.id} 
                      className="group relative p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleResearchQueryClick(query)}
                    >
                      {/* Delete Button - Shows on Hover */}
                      <button
                        onClick={(e) => handleResearchQueryDelete(query.id, e)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full hover:bg-destructive/10 text-destructive hover:text-destructive-foreground"
                        title="Delete research query"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-center justify-between mb-2 pr-8">
                        <h4 className="font-medium text-foreground truncate">{query.queryText}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            query.confidenceScore > 0.7 ? 'bg-green-100 text-green-800' :
                            query.confidenceScore > 0.4 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {Math.round(query.confidenceScore * 100)}%
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            query.processingStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            query.processingStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {query.processingStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{query.findings?.length || 0} findings</span>
                        <span>{query.relatedTopics?.length || 0} related topics</span>
                        {query.followUpQuestions && (
                          <span>{query.followUpQuestions.length} follow-up questions</span>
                        )}
                      </div>
                      
                      {/* Show some findings preview */}
                      {query.findings && query.findings.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <h5 className="text-sm font-medium text-foreground">Key Findings:</h5>
                          {query.findings.slice(0, 2).map((finding: any, index: number) => (
                            <div key={index} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                              <div className="font-medium text-foreground">{finding.finding}</div>
                              <div className="text-muted-foreground mt-1">
                                Confidence: {Math.round((finding.confidence || 0) * 100)}%
                              </div>
                            </div>
                          ))}
                          {query.findings.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{query.findings.length - 2} more findings...
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show related topics */}
                      {query.relatedTopics && query.relatedTopics.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-sm font-medium text-foreground mb-2">Related Topics:</h5>
                          <div className="flex flex-wrap gap-1">
                            {query.relatedTopics.slice(0, 3).map((topic: any, index: number) => (
                              <span key={index} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {topic.topic}
                              </span>
                            ))}
                            {query.relatedTopics.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{query.relatedTopics.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Study Session Orchestrator */}
        {activeTab === 'study-session' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Study Session Orchestrator</h2>
                  <p className="text-sm text-muted-foreground">Adaptive learning with real-time difficulty adjustment</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Session Type</label>
                  <select
                    value={studySessionForm.sessionType}
                    onChange={(e) => setStudySessionForm(prev => ({ ...prev, sessionType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="adaptive">Adaptive</option>
                    <option value="review">Review</option>
                    <option value="practice">Practice</option>
                    <option value="assessment">Assessment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    value={studySessionForm.duration}
                    onChange={(e) => setStudySessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    min="15"
                    max="120"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Focus Areas (comma-separated)</label>
                  <input
                    type="text"
                    value={studySessionForm.focusAreas.join(', ')}
                    onChange={(e) => setStudySessionForm(prev => ({ 
                      ...prev, 
                      focusAreas: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                    }))}
                    placeholder="e.g., machine learning, data analysis"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  />
                </div>

                <button
                  onClick={orchestrateStudySession}
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Zap className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Orchestrate Study Session
                </button>
              </div>
            </div>

            {/* Study Sessions */}
            <div className="bg-card rounded-lg p-6 border border-border flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Study Sessions</h3>
                <button
                  onClick={() => setShowPerformanceDashboard(true)}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-md hover:bg-blue-200 transition-colors flex items-center gap-1"
                >
                  <BarChart3 className="w-4 h-4" />
                  Performance
                </button>
              </div>
              {studySessions.length === 0 ? (
                <p className="text-muted-foreground">No study sessions created yet</p>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-96 space-y-3 pr-2">
                  {studySessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="group relative p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleStudySessionClick(session)}
                    >
                      {/* Delete Button - Shows on Hover */}
                      <button
                        onClick={(e) => handleStudySessionDelete(session.id, e)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full hover:bg-destructive/10 text-destructive hover:text-destructive-foreground"
                        title="Delete study session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-center justify-between mb-2 pr-8">
                        <h4 className="font-medium text-foreground">{session.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          session.status === 'active' ? 'bg-green-100 text-green-800' :
                          session.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.durationMinutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.questionsCount || 0} questions
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Learning Path Detail Modal */}
        {showLearningPathModal && selectedLearningPath && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{selectedLearningPath.title}</h2>
                    <p className="text-muted-foreground">{selectedLearningPath.description}</p>
                  </div>
                  <button
                    onClick={closeLearningPathModal}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {selectedLearningPath.learningSteps?.filter(step => step.isCompleted).length || 0} / {selectedLearningPath.learningSteps?.length || 0} steps completed
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${selectedLearningPath.progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className="text-center mt-1">
                    <span className="text-lg font-semibold text-primary">
                      {selectedLearningPath.progressPercentage}%
                    </span>
                  </div>
                </div>

                {/* Path Stats */}
                <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {selectedLearningPath.estimatedDuration} minutes
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {selectedLearningPath.difficultyLevel}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {selectedLearningPath.subjectArea}
                  </span>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Learning Steps</h3>
                  {selectedLearningPath.learningSteps && selectedLearningPath.learningSteps.length > 0 ? (
                    <div className="space-y-3">
                      {selectedLearningPath.learningSteps.map((step, index) => (
                        <div key={step.id} className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                          step.isCompleted 
                            ? 'border-green-200 bg-green-50/50' 
                            : 'border-border hover:bg-muted/30'
                        }`}>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleStepCompletion(step.id, !step.isCompleted)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                step.isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-primary'
                              }`}
                            >
                              {step.isCompleted && <Check className="w-4 h-4" />}
                            </button>
                            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className={`text-sm font-medium ${
                                step.isCompleted ? 'text-green-600' : 'text-primary'
                              }`}>
                                {step.stepOrder}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`font-medium ${
                                step.isCompleted ? 'text-green-700 line-through' : 'text-foreground'
                              }`}>
                                {step.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                  {step.stepType}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {step.estimatedDuration} min
                                </span>
                                {step.isCompleted && (
                                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                    Completed
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Step {step.stepOrder} of {selectedLearningPath.learningSteps.length}
                              {step.completedAt && (
                                <span className="ml-2 text-green-600">
                                  • Completed {new Date(step.completedAt).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No learning steps available yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button
                  onClick={closeLearningPathModal}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  Start Learning Path
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Research Query Detail Modal */}
        {showResearchModal && selectedResearchQuery && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{selectedResearchQuery.queryText}</h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Search className="w-4 h-4" />
                        {selectedResearchQuery.queryType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {Math.round(selectedResearchQuery.confidenceScore * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closeResearchModal}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-6">
                  {/* Key Findings */}
                  {selectedResearchQuery.findings && selectedResearchQuery.findings.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Key Findings</h3>
                      <div className="space-y-3">
                        {selectedResearchQuery.findings.map((finding: any, index: number) => (
                          <div key={index} className="p-4 border border-border rounded-lg bg-muted/30">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-foreground flex-1">{finding.finding}</h4>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded ml-2">
                                {Math.round((finding.confidence || 0) * 100)}%
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{finding.explanation}</p>
                            <div className="text-xs text-muted-foreground">
                              <strong>Source:</strong> {finding.sourceDocument}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Topics */}
                  {selectedResearchQuery.relatedTopics && selectedResearchQuery.relatedTopics.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Related Topics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedResearchQuery.relatedTopics.map((topic: any, index: number) => (
                          <div key={index} className="p-3 border border-border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-foreground">{topic.topic}</h4>
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                {Math.round((topic.relevance || 0) * 100)}% relevant
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{topic.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {selectedResearchQuery.followUpQuestions && selectedResearchQuery.followUpQuestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Follow-up Questions</h3>
                      <div className="space-y-2">
                        {selectedResearchQuery.followUpQuestions.map((question: any, index: number) => (
                          <div key={index} className="p-3 border border-border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm text-foreground flex-1">{question.question}</p>
                              <div className="flex gap-1 ml-2">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {question.type}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  question.priority === 'high' ? 'bg-red-100 text-red-800' :
                                  question.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {question.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Synthesis */}
                  {selectedResearchQuery.synthesis && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Synthesis</h3>
                      <div className="p-4 border border-border rounded-lg bg-primary/5">
                        <p className="text-sm text-foreground">{selectedResearchQuery.synthesis.summary}</p>
                        {selectedResearchQuery.synthesis.knowledgeGaps && (
                          <div className="mt-3">
                            <h4 className="font-medium text-foreground mb-2">Knowledge Gaps Identified:</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {selectedResearchQuery.synthesis.knowledgeGaps.map((gap: string, index: number) => (
                                <li key={index}>{gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Content Message */}
                  {(!selectedResearchQuery.findings || selectedResearchQuery.findings.length === 0) &&
                   (!selectedResearchQuery.relatedTopics || selectedResearchQuery.relatedTopics.length === 0) &&
                   (!selectedResearchQuery.followUpQuestions || selectedResearchQuery.followUpQuestions.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No detailed research content available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button
                  onClick={closeResearchModal}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  Export Results
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Study Session Detail Modal */}
        {showStudySessionModal && selectedStudySession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
                <h2 className="text-xl font-semibold text-foreground">{selectedStudySession.title}</h2>
                <button 
                  onClick={closeStudySessionModal}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {/* Session Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-medium text-foreground mb-2">Session Type</h3>
                    <p className="text-sm text-muted-foreground capitalize">{selectedStudySession.sessionType}</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-medium text-foreground mb-2">Duration</h3>
                    <p className="text-sm text-muted-foreground">{selectedStudySession.durationMinutes} minutes</p>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-medium text-foreground mb-2">Questions</h3>
                    <p className="text-sm text-muted-foreground">{selectedStudySession.questionsCount || 0} generated</p>
                  </div>
                </div>

                {/* Knowledge Assessment */}
                {(selectedStudySession as any).sessionData?.knowledgeAssessment && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Knowledge Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-border rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Overall Level</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {(selectedStudySession as any).sessionData.knowledgeAssessment.overallLevel || 'Not assessed'}
                        </p>
                      </div>
                      <div className="p-4 border border-border rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">Strengths</h4>
                        <div className="flex flex-wrap gap-1">
                          {((selectedStudySession as any).sessionData.knowledgeAssessment.strengths || []).map((strength: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {strength}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content Selection */}
                {selectedStudySession.contentSelection?.documents && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Selected Content</h3>
                    <div className="space-y-3">
                      {selectedStudySession.contentSelection.documents.map((doc: any, index: number) => (
                        <div key={index} className="p-4 border border-border rounded-lg">
                          <h4 className="font-medium text-foreground mb-2">{doc.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-3">{doc.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Questions */}
                {(selectedStudySession as any).sessionData?.adaptiveQuestions && (selectedStudySession as any).sessionData.adaptiveQuestions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Generated Questions</h3>
                    <div className="space-y-4">
                      {(selectedStudySession as any).sessionData.adaptiveQuestions.map((question: any, index: number) => (
                        <div key={index} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                              {question.type?.replace('_', ' ')}
                            </span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              {question.difficulty}
                            </span>
                          </div>
                          <h4 className="font-medium text-foreground mb-2">{question.question}</h4>
                          {question.options && (
                            <div className="space-y-1 mb-2">
                              {question.options.map((option: string, optIndex: number) => (
                                <p key={optIndex} className="text-sm text-muted-foreground">
                                  {String.fromCharCode(65 + optIndex)}. {option}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-green-600 font-medium">Answer: {question.correctAnswer}</p>
                          <p className="text-sm text-muted-foreground mt-2">{question.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Metrics */}
                {selectedStudySession.performanceMetrics && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Performance Metrics</h3>
                    <div className="p-4 border border-border rounded-lg">
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {JSON.stringify(selectedStudySession.performanceMetrics, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-border flex-shrink-0 bg-background">
                <button 
                  onClick={closeStudySessionModal}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                >
                  Close
                </button>
                {selectedStudySession && (selectedStudySession.questionsCount || 0) > 0 && (
                  <button 
                    onClick={() => startStudySession(selectedStudySession)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Start Session
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Study Interface */}
        {showInteractiveStudy && selectedStudySession && (
          <InteractiveStudyInterface
            studySession={selectedStudySession}
            onSessionComplete={handleSessionComplete}
            onClose={closeInteractiveStudy}
            getAuthenticatedFetch={getAuthenticatedFetch}
          />
        )}

        {/* Performance Dashboard */}
        {showPerformanceDashboard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
                <h2 className="text-xl font-semibold text-foreground">Performance Dashboard</h2>
                <button 
                  onClick={() => setShowPerformanceDashboard(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <PerformanceDashboard studySessions={studySessions} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AIAgentsPage = () => {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <AIAgentsPageContent />
    </Suspense>
  );
};

export default AIAgentsPage;
