import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { studySessionService, userService } from '@/lib/tidb-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const appwriteUser = await getCurrentUser(req);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const sessionId = params.id;
    const { questionId, answer, timeSpent } = await req.json();

    // Get study session
    const studySession = await studySessionService.getById(sessionId);
    if (!studySession) {
      return NextResponse.json({ error: 'Study session not found' }, { status: 404 });
    }

    // Verify ownership
    if (studySession.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the question
    const questions = studySession.sessionData?.adaptiveQuestions || [];
    const question = questions.find((q: any) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check if answer is correct
    const isCorrect = checkAnswer(question, answer);
    
    // Update session data
    const currentAnswers = studySession.sessionData?.answers || [];
    const newAnswer = {
      questionId,
      answer,
      isCorrect,
      timeSpent,
      timestamp: new Date().toISOString()
    };

    const updatedAnswers = [...currentAnswers, newAnswer];
    const correctCount = updatedAnswers.filter(a => a.isCorrect).length;
    const currentQuestionIndex = (studySession.sessionData?.currentQuestionIndex || 0) + 1;

    const isSessionComplete = currentQuestionIndex >= questions.length;

    const updateData: any = {
      status: isSessionComplete ? 'completed' : 'active',
      sessionData: {
        ...studySession.sessionData,
        currentQuestionIndex,
        answers: updatedAnswers,
        sessionProgress: {
          totalQuestions: questions.length,
          answeredQuestions: currentQuestionIndex,
          correctAnswers: correctCount,
          timeSpent: (studySession.sessionData?.sessionProgress?.timeSpent || 0) + (timeSpent || 0)
        }
      }
    };

    // Only set endTime if session is complete
    if (isSessionComplete) {
      updateData.endTime = new Date();
    }

    await studySessionService.update(sessionId, updateData);

    // Get updated session
    const updatedSession = await studySessionService.getById(sessionId);

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isSessionComplete,
      studySession: updatedSession
    });

  } catch (error) {
    console.error('Study session answer error:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}

function checkAnswer(question: any, userAnswer: string): boolean {
  if (question.type === 'multiple_choice') {
    // For multiple choice, correctAnswer should be the index (0, 1, 2, 3)
    return userAnswer === question.correctAnswer;
  } else {
    // For short answer and application questions, do a fuzzy match
    const correctAnswer = question.correctAnswer.toLowerCase();
    const userAnswerLower = userAnswer.toLowerCase();
    
    // Simple keyword matching for now
    const correctKeywords = correctAnswer.split(' ').filter((word: string) => word.length > 3);
    const userKeywords = userAnswerLower.split(' ').filter((word: string) => word.length > 3);
    
    const matchingKeywords = correctKeywords.filter((keyword: string) => 
      userKeywords.some((userKeyword: string) => userKeyword.includes(keyword) || keyword.includes(userKeyword))
    );
    
    return matchingKeywords.length >= Math.ceil(correctKeywords.length * 0.5);
  }
}
