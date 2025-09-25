import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, studySessionService, learningPathService, learningStepService, quizResultService, dashboardItemService, workspaceService } from '@/lib/tidb-service';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(req);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const { 
      sessionType = 'adaptive',
      learningPathId,
      duration = 30,
      focusAreas = [],
      difficultyPreference = 'auto'
    } = await req.json();

    console.log('🎯 Study Session Orchestration:', {
      userId: dbUser.id,
      sessionType,
      learningPathId,
      duration,
      focusAreas,
      difficultyPreference
    });

    // Step 1: Assess current knowledge level
    const knowledgeAssessment = await assessCurrentKnowledge(dbUser.id, learningPathId);
    
    // Step 2: Select optimal content based on assessment
    const contentSelection = await selectOptimalContent(
      dbUser.id, 
      learningPathId, 
      knowledgeAssessment, 
      focusAreas,
      duration
    );

    // Step 3: Create adaptive study session
    const studySession = await studySessionService.create({
      userId: dbUser.id,
      learningPathId: learningPathId || null,
      sessionType,
      title: `Adaptive Study Session - ${new Date().toLocaleDateString()}`,
      description: `Intelligent study session focusing on ${focusAreas.length > 0 ? focusAreas.join(', ') : 'comprehensive review'}`,
      contentSelection,
      difficultyProgression: knowledgeAssessment.difficultyProgression,
      sessionData: {
        knowledgeAssessment,
        contentSelection,
        adaptiveParameters: {
          difficultyPreference,
          duration,
          focusAreas
        }
      },
      performanceMetrics: {
        initialKnowledgeLevel: knowledgeAssessment.overallLevel,
        targetImprovement: knowledgeAssessment.improvementTargets
      },
      status: 'active',
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 60 * 1000), // Add duration in milliseconds
      durationMinutes: duration
    });

    console.log(`✅ Created adaptive study session: ${studySession.id}`);

    // Step 4: Generate mixed-format questions with adaptive difficulty
    const adaptiveQuestions = await generateAdaptiveQuestions(
      contentSelection,
      knowledgeAssessment,
      sessionType
    );

    // Step 5: Create real-time adaptation rules
    const adaptationRules = await createAdaptationRules(
      knowledgeAssessment,
      adaptiveQuestions
    );

    // Update session with generated content and questions count
    await studySessionService.update(studySession.id, {
      sessionData: {
        ...studySession.sessionData,
        adaptiveQuestions,
        adaptationRules,
        realTimeAdaptation: true
      },
      questionsCount: adaptiveQuestions.length
    });

    return NextResponse.json({
      success: true,
      studySession: {
        id: studySession.id,
        title: studySession.title,
        sessionType: studySession.sessionType,
        duration: studySession.durationMinutes,
        status: studySession.status
      },
      knowledgeAssessment: {
        overallLevel: knowledgeAssessment.overallLevel,
        strengths: knowledgeAssessment.strengths,
        weaknesses: knowledgeAssessment.weaknesses,
        improvementTargets: knowledgeAssessment.improvementTargets
      },
      contentSelection: {
        selectedDocuments: contentSelection.documents.length,
        topics: contentSelection.topics,
        difficultyLevel: contentSelection.recommendedDifficulty
      },
      adaptiveQuestions: {
        totalQuestions: adaptiveQuestions.length,
        questionTypes: adaptiveQuestions.reduce((acc, q) => {
          acc[q.type] = (acc[q.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        difficultyDistribution: adaptiveQuestions.reduce((acc, q) => {
          acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      adaptationRules: {
        difficultyAdjustment: adaptationRules.difficultyAdjustment,
        contentSelection: adaptationRules.contentSelection,
        feedbackTiming: adaptationRules.feedbackTiming
      }
    });

  } catch (error: any) {
    console.error('Study session orchestration error:', error);
    return NextResponse.json(
      { error: 'Failed to orchestrate study session', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to assess current knowledge
async function assessCurrentKnowledge(userId: string, learningPathId?: string) {
  // Get recent quiz results for knowledge assessment
  const recentResults = await quizResultService.getByUserId(userId);
  const relevantResults = learningPathId 
    ? recentResults.filter(result => result.itemId && result.completedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
    : recentResults.slice(0, 10); // Last 10 results

  // Analyze performance patterns
  const performanceAnalysis = {
    averageScore: relevantResults.reduce((sum, result) => sum + (result.score / result.totalQuestions), 0) / relevantResults.length || 0.5,
    consistencyScore: calculateConsistency(relevantResults),
    improvementTrend: calculateImprovementTrend(relevantResults),
    topicPerformance: analyzeTopicPerformance(relevantResults)
  };

  // Determine overall knowledge level
  const overallLevel = performanceAnalysis.averageScore > 0.8 ? 'advanced' : 
                      performanceAnalysis.averageScore > 0.6 ? 'intermediate' : 'beginner';

  // Identify strengths and weaknesses
  const strengths = Object.entries(performanceAnalysis.topicPerformance)
    .filter(([_, score]) => score > 0.7)
    .map(([topic, _]) => topic);

  const weaknesses = Object.entries(performanceAnalysis.topicPerformance)
    .filter(([_, score]) => score < 0.5)
    .map(([topic, _]) => topic);

  return {
    overallLevel,
    performanceAnalysis,
    strengths,
    weaknesses,
    improvementTargets: weaknesses.slice(0, 3), // Focus on top 3 weaknesses
    difficultyProgression: generateDifficultyProgression(overallLevel, performanceAnalysis.consistencyScore)
  };
}

// Helper function to select optimal content
async function selectOptimalContent(
  userId: string, 
  learningPathId: string | undefined, 
  knowledgeAssessment: any, 
  focusAreas: string[],
  duration: number
) {
  let documents: any[] = [];
  
  if (learningPathId) {
    // Get learning path steps and their content references
    const learningPath = await learningPathService.getById(learningPathId);
    if (learningPath) {
      const steps = await learningStepService.getByLearningPathId(learningPathId);
      const contentIds = steps.flatMap(step => step.contentReferences || []);
      
      // Get documents for these content references
      documents = await Promise.all(
        contentIds.map(async (id: string) => {
          const item = await dashboardItemService.getById(id);
          return item ? {
            id: item.id,
            title: item.title,
            content: item.content,
            fileType: item.fileType
          } : null;
        })
      );
      documents = documents.filter(doc => doc !== null);
    }
  } else {
    // Get user's documents and filter by focus areas
    // Get user's default workspace
    const userWorkspaces = await workspaceService.getByUserId(userId);
    if (userWorkspaces && userWorkspaces.length > 0) {
      const defaultWorkspace = userWorkspaces.find(w => w.isDefault) || userWorkspaces[0];
      const allItems = await dashboardItemService.getAllByWorkspaceId(defaultWorkspace.id);
      documents = allItems.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        fileType: item.fileType
      }));
    } else {
      documents = [];
    }
  }

  // Filter documents by focus areas if specified
  if (focusAreas.length > 0) {
    documents = documents.filter(doc => 
      focusAreas.some(area => 
        doc.title.toLowerCase().includes(area.toLowerCase()) ||
        doc.content.toLowerCase().includes(area.toLowerCase())
      )
    );
  }

  // Select optimal subset based on duration and knowledge level
  const maxDocuments = Math.ceil(duration / 10); // ~10 minutes per document
  const selectedDocuments = documents.slice(0, maxDocuments);

  return {
    documents: selectedDocuments,
    topics: focusAreas.length > 0 ? focusAreas : extractTopics(selectedDocuments),
    recommendedDifficulty: knowledgeAssessment.overallLevel,
    estimatedDuration: selectedDocuments.length * 10
  };
}

// Helper function to generate adaptive questions
async function generateAdaptiveQuestions(
  contentSelection: any,
  knowledgeAssessment: any,
  sessionType: string
) {
  const questions = [];
  
  for (const doc of contentSelection.documents.slice(0, 3)) { // Limit to 3 documents
    try {
      const questionPrompt = `Create adaptive questions for this content based on the learner's knowledge level: ${knowledgeAssessment.overallLevel}

Content: ${doc.content.substring(0, 1500)}
Strengths: ${knowledgeAssessment.strengths.join(', ')}
Weaknesses: ${knowledgeAssessment.weaknesses.join(', ')}
Session Type: ${sessionType}

Create 2 questions that:
1. Target the learner's weaknesses for improvement
2. Reinforce their strengths for confidence
3. Adapt difficulty based on their level
4. Include mixed formats (multiple choice, short answer, application)

IMPORTANT: Return ONLY valid JSON array format. No markdown, no explanations, just pure JSON:

[
  {
    "type": "multiple_choice",
    "difficulty": "medium",
    "targetArea": "general",
    "question": "What is the main topic discussed in this content?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "0",
    "explanation": "This is the correct answer because...",
    "learningObjective": "Identify main topic"
  },
  {
    "type": "short_answer",
    "difficulty": "easy",
    "targetArea": "strength",
    "question": "Summarize the key points in 2-3 sentences.",
    "correctAnswer": "The key points are...",
    "explanation": "This tests understanding of main concepts.",
    "learningObjective": "Summarize content"
  }
]`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are an expert educational content creator that designs adaptive questions. You create questions that match learner needs and provide appropriate challenge levels. ALWAYS respond with ONLY valid JSON array format. No markdown, no explanations, just pure JSON."
          },
          {
            role: "user",
            content: questionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (response) {
        try {
          // Try to extract JSON from markdown code blocks
          let jsonString = response;
          const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
          } else {
            // Try to find JSON array in the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              jsonString = jsonMatch[0];
            }
          }
          
          const docQuestions = JSON.parse(jsonString);
          if (Array.isArray(docQuestions)) {
            questions.push(...docQuestions.map((q: any, index: number) => ({
              ...q,
              id: `${doc.id}_q${index}`,
              sourceDocument: doc.id,
              sourceTitle: doc.title
            })));
            console.log(`✅ Generated ${docQuestions.length} questions for document: ${doc.title}`);
          } else {
            console.warn('AI response is not an array for document:', doc.title);
          }
        } catch (parseError) {
          console.warn('Failed to parse questions for document:', doc.title, 'Response:', response.substring(0, 200));
          console.warn('Parse error:', parseError instanceof Error ? parseError.message : 'Unknown parse error');
        }
      }
    } catch (error) {
      console.warn('Failed to generate questions for document:', doc.title, error);
    }
  }

  // If no questions were generated, create some fallback questions
  if (questions.length === 0 && contentSelection.documents.length > 0) {
    console.log('No questions generated, creating fallback questions');
    const doc = contentSelection.documents[0];
    questions.push(
      {
        id: `${doc.id}_fallback_1`,
        type: 'multiple_choice',
        difficulty: 'medium',
        targetArea: 'general',
        question: `Based on the content from "${doc.title}", what is the main topic or subject matter?`,
        options: [
          'Professional development and career growth',
          'Technical skills and programming',
          'Business and management',
          'Education and learning'
        ],
        correctAnswer: '0',
        explanation: 'This question tests your understanding of the main topic discussed in the document.',
        learningObjective: 'Identify main topic and subject matter',
        sourceDocument: doc.id,
        sourceTitle: doc.title
      },
      {
        id: `${doc.id}_fallback_2`,
        type: 'short_answer',
        difficulty: 'easy',
        targetArea: 'general',
        question: `Summarize the key points mentioned in "${doc.title}" in 2-3 sentences.`,
        correctAnswer: 'Student should identify and summarize the main points from the document content.',
        explanation: 'This question tests your ability to extract and summarize key information from the document.',
        learningObjective: 'Summarize key information',
        sourceDocument: doc.id,
        sourceTitle: doc.title
      }
    );
  }

  console.log(`📝 Generated ${questions.length} total questions`);
  return questions;
}

// Helper function to create adaptation rules
async function createAdaptationRules(knowledgeAssessment: any, questions: any[]) {
  return {
    difficultyAdjustment: {
      ifCorrectRateAbove: 0.8,
      thenIncreaseDifficulty: true,
      ifCorrectRateBelow: 0.4,
      thenDecreaseDifficulty: true,
      adjustmentAmount: 0.1
    },
    contentSelection: {
      focusOnWeaknesses: true,
      reinforceStrengths: true,
      adaptivePacing: true
    },
    feedbackTiming: {
      immediateFeedback: true,
      detailedExplanation: true,
      encouragementThreshold: 0.6
    }
  };
}

// Helper functions
function calculateConsistency(results: any[]): number {
  if (results.length < 2) return 0.5;
  
  const scores = results.map(r => r.score / r.totalQuestions);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  
  return Math.max(0, 1 - Math.sqrt(variance));
}

function calculateImprovementTrend(results: any[]): number {
  if (results.length < 3) return 0;
  
  const scores = results.map(r => r.score / r.totalQuestions);
  const recent = scores.slice(0, Math.ceil(scores.length / 2));
  const older = scores.slice(Math.ceil(scores.length / 2));
  
  const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
  
  return recentAvg - olderAvg;
}

function analyzeTopicPerformance(results: any[]): Record<string, number> {
  const topicScores: Record<string, number[]> = {};
  
  results.forEach(result => {
    if (result.topicAnalysis && result.topicAnalysis.byTopic) {
      Object.entries(result.topicAnalysis.byTopic).forEach(([topic, score]) => {
        if (!topicScores[topic]) topicScores[topic] = [];
        topicScores[topic].push(score as number);
      });
    }
  });
  
  const topicPerformance: Record<string, number> = {};
  Object.entries(topicScores).forEach(([topic, scores]) => {
    topicPerformance[topic] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  });
  
  return topicPerformance;
}

function generateDifficultyProgression(level: string, consistency: number): any {
  const baseProgression = {
    beginner: [0.3, 0.4, 0.5, 0.6],
    intermediate: [0.5, 0.6, 0.7, 0.8],
    advanced: [0.7, 0.8, 0.9, 0.95]
  };
  
  const progression = baseProgression[level as keyof typeof baseProgression] || baseProgression.intermediate;
  
  // Adjust based on consistency
  const adjustedProgression = progression.map(difficulty => 
    Math.max(0.1, Math.min(0.95, difficulty * (0.8 + consistency * 0.4)))
  );
  
  return adjustedProgression;
}

function extractTopics(documents: any[]): string[] {
  const topics = new Set<string>();
  
  documents.forEach(doc => {
    // Simple topic extraction based on common keywords
    const content = doc.content.toLowerCase();
    const commonTopics = ['technology', 'business', 'science', 'education', 'health', 'finance', 'marketing'];
    
    commonTopics.forEach(topic => {
      if (content.includes(topic)) {
        topics.add(topic);
      }
    });
  });
  
  return Array.from(topics);
}
