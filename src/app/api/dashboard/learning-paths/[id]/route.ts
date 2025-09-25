import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, learningPathService } from '@/lib/tidb-service';

export async function DELETE(
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

    // Check if learning path exists and belongs to user
    const learningPath = await learningPathService.getById(learningPathId);
    if (!learningPath) {
      return NextResponse.json({ error: 'Learning path not found' }, { status: 404 });
    }

    if (learningPath.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized to delete this learning path' }, { status: 403 });
    }

    // Delete the learning path
    await learningPathService.delete(learningPathId);

    console.log(`Deleted learning path ${learningPathId} for user ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      message: 'Learning path deleted successfully'
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/dashboard/learning-paths/[id]:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete learning path', details: error.message },
      { status: 500 }
    );
  }
}
