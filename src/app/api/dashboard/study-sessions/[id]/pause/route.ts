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
    const { action } = await req.json(); // 'pause' or 'resume'

    // Get study session
    const studySession = await studySessionService.getById(sessionId);
    if (!studySession) {
      return NextResponse.json({ error: 'Study session not found' }, { status: 404 });
    }

    // Verify ownership
    if (studySession.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const newStatus = action === 'pause' ? 'paused' : 'active';
    const now = new Date();

    await studySessionService.update(sessionId, {
      status: newStatus,
      sessionData: {
        ...studySession.sessionData,
        lastAction: action,
        lastActionTime: now.toISOString(),
        sessionProgress: {
          ...studySession.sessionData?.sessionProgress,
          totalTimeSpent: (studySession.sessionData?.sessionProgress?.totalTimeSpent || 0) + 
            (action === 'pause' ? (now.getTime() - new Date(studySession.startTime || now).getTime()) : 0)
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
    console.error('Study session pause/resume error:', error);
    return NextResponse.json(
      { error: 'Failed to pause/resume study session' },
      { status: 500 }
    );
  }
}
