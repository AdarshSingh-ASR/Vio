import { NextRequest, NextResponse } from 'next/server';
import { userService, quizResultService } from '@/lib/tidb-service';
import { getCurrentUser } from '@/lib/appwrite-server';

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
      itemId, 
      itemName, 
      score, 
      totalQuestions, 
      timeSpent, 
      type, 
      answers,
      questions
    } = await req.json();

    console.log('📊 Quiz result data received:', {
      itemId,
      itemName,
      score,
      totalQuestions,
      timeSpent,
      type,
      answersLength: answers?.length || 0,
      questionsLength: questions?.length || 0,
      answers: answers,
      questions: questions
    });

    if (!itemId || typeof score !== 'number' || typeof totalQuestions !== 'number') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Analyze performance by topic
    const topicAnalysis = analyzeTopicPerformance(questions || [], answers || []);

    // Create quiz result in TiDB
    const quizResult = await quizResultService.create({
      userId: dbUser.id,
      itemId,
      itemName: itemName || 'Untitled',
      quizType: type || 'quiz',
      score,
      totalQuestions,
      timeSpent: timeSpent || 0,
      percentage: Math.round((score / totalQuestions) * 100),
      questions: questions || [],
      answers: answers || [],
      topicAnalysis: topicAnalysis
    });

    console.log("Quiz result saved successfully:", quizResult.id);

    return NextResponse.json({ 
      success: true, 
      result: {
        $id: quizResult.id,
        id: quizResult.id,
        userId: quizResult.userId,
        itemId: quizResult.itemId,
        itemName: quizResult.itemName,
        score: quizResult.score,
        totalQuestions: quizResult.totalQuestions,
        timeSpent: quizResult.timeSpent,
        type: quizResult.quizType,
        percentage: quizResult.percentage,
        answers: quizResult.answers,
        questions: quizResult.questions,
        topicAnalysis: quizResult.topicAnalysis,
        completedAt: quizResult.completedAt,
        createdAt: quizResult.createdAt
      },
      topicAnalysis
    });

  } catch (error: any) {
    console.error('Save quiz result error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save quiz result' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
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
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'quiz' or 'listening'
    
    // Fetch quiz results from TiDB
    let results = await quizResultService.getByUserId(dbUser.id);
    
    // Filter by type if specified
    if (type && (type === 'quiz' || type === 'listening')) {
      results = results.filter(result => result.quizType === type);
    }
    
    console.log(`Found ${results.length} quiz results for user`);

    // Transform to match frontend expectations
    const processedResults = results.map(result => ({
      $id: result.id,
      id: result.id,
      userId: result.userId,
      itemId: result.itemId,
      itemName: result.itemName,
      score: result.score,
      totalQuestions: result.totalQuestions,
      timeSpent: result.timeSpent,
      type: result.quizType,
      percentage: result.percentage,
      answers: result.answers || [],
      questions: result.questions || [],
      topicAnalysis: result.topicAnalysis || null,
      completedAt: result.completedAt,
      createdAt: result.createdAt
    }));

    return NextResponse.json({ 
      success: true, 
      results: processedResults 
    });

  } catch (error: any) {
    console.error('Get quiz results error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch quiz results' },
      { status: 500 }
    );
  }
}

// Helper function to analyze performance by topic
function analyzeTopicPerformance(questions: any[], answers: number[]) {
  const topicStats: { [key: string]: { correct: number; total: number; questions: number[] } } = {};
  
  questions.forEach((question, index) => {
    const topic = question.topic || 'General';
    if (!topicStats[topic]) {
      topicStats[topic] = { correct: 0, total: 0, questions: [] };
    }
    
    topicStats[topic].total++;
    topicStats[topic].questions.push(index);
    
    if (answers[index] === question.correctAnswer) {
      topicStats[topic].correct++;
    }
  });

  // Convert to analysis format
  const analysis = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    correct: stats.correct,
    total: stats.total,
    percentage: Math.round((stats.correct / stats.total) * 100),
    questionIndices: stats.questions
  }));

  // Sort by performance (worst first for improvement suggestions)
  analysis.sort((a, b) => a.percentage - b.percentage);

  return {
    byTopic: analysis,
    weakestTopics: analysis.filter(a => a.percentage < 70).slice(0, 3),
    strongestTopics: analysis.filter(a => a.percentage >= 80).slice(0, 3),
    overallInsights: generateInsights(analysis)
  };
}

// Helper function to generate insights and suggestions
function generateInsights(topicAnalysis: any[]) {
  const totalTopics = topicAnalysis.length;
  const weakTopics = topicAnalysis.filter(t => t.percentage < 70);
  const strongTopics = topicAnalysis.filter(t => t.percentage >= 80);
  
  let insights = [];
  
  if (weakTopics.length > 0) {
    insights.push(`Focus on improving: ${weakTopics.map(t => t.topic).join(', ')}`);
  }
  
  if (strongTopics.length > 0) {
    insights.push(`Strong areas: ${strongTopics.map(t => t.topic).join(', ')}`);
  }
  
  if (weakTopics.length === 0) {
    insights.push("Excellent performance across all topics!");
  } else if (weakTopics.length > totalTopics / 2) {
    insights.push("Consider reviewing the material before retaking the quiz");
  }
  
  return insights;
} 