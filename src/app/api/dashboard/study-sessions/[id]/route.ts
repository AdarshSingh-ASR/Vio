import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { studySessionService } from '@/lib/tidb-service';

export async function GET(
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
    const { userService } = await import('@/lib/tidb-service');
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

    return NextResponse.json({
      success: true,
      studySession
    });

  } catch (error) {
    console.error('Study session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve study session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { userService } = await import('@/lib/tidb-service');
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

    const updates = await req.json();
    
    // Update study session
    await studySessionService.update(sessionId, updates);
    
    // Get updated session
    const updatedSession = await studySessionService.getById(sessionId);
    
    return NextResponse.json({
      success: true,
      studySession: updatedSession
    });

  } catch (error) {
    console.error('Study session update error:', error);
    return NextResponse.json(
      { error: 'Failed to update study session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { userService } = await import('@/lib/tidb-service');
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

    // Delete study session
    await studySessionService.delete(sessionId);

    console.log(`Deleted study session ${sessionId} for user ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      message: 'Study session deleted successfully'
    });

  } catch (error) {
    console.error('Study session deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete study session' },
      { status: 500 }
    );
  }
}