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
    
    // Get study session
    const studySession = await studySessionService.getById(sessionId);
    if (!studySession) {
      return NextResponse.json({ error: 'Study session not found' }, { status: 404 });
    }

    // Verify ownership
    if (studySession.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update session to active status
    await studySessionService.update(sessionId, {
      status: 'active',
      startTime: new Date(),
      sessionData: {
        ...studySession.sessionData,
        currentQuestionIndex: 0,
        answers: [],
        startTime: new Date().toISOString(),
        sessionProgress: {
          totalQuestions: studySession.questionsCount || 0,
          answeredQuestions: 0,
          correctAnswers: 0,
          timeSpent: 0
        }
      }
    });

    // Get updated session
    const updatedSession = await studySessionService.getById(sessionId);

    return NextResponse.json({
      success: true,
      studySession: updatedSession
    });

  } catch (error) {
    console.error('Study session start error:', error);
    return NextResponse.json(
      { error: 'Failed to start study session' },
      { status: 500 }
    );
  }
}
