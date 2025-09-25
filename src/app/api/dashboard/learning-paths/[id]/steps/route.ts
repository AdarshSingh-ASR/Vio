import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, learningPathService, learningStepService } from '@/lib/tidb-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(request);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const learningPathId = params.id;

    // Verify the learning path belongs to the user
    const learningPath = await learningPathService.getById(learningPathId);
    if (!learningPath) {
      return NextResponse.json({ error: 'Learning path not found' }, { status: 404 });
    }

    if (learningPath.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get learning steps for this path
    const learningSteps = await learningStepService.getByLearningPathId(learningPathId);

    console.log(`Found ${learningSteps.length} learning steps for path ${learningPathId}`);

    return NextResponse.json({
      success: true,
      learningSteps: learningSteps,
      learningPath: learningPath
    });

  } catch (error: any) {
    console.error('Error in GET /api/dashboard/learning-paths/[id]/steps:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch learning steps', details: error.message },
      { status: 500 }
    );
  }
}
