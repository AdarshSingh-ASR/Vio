import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { studySessionService, userService } from '@/lib/tidb-service';

export async function GET(req: NextRequest) {
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

    // Get study sessions for user
    const studySessions = await studySessionService.getByUserId(dbUser.id);
    
    return NextResponse.json({
      success: true,
      studySessions
    });

  } catch (error) {
    console.error('Study sessions retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve study sessions' },
      { status: 500 }
    );
  }
}
