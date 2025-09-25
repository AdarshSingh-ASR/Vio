import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, learningPathService, workspaceService } from '@/lib/tidb-service';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    // Get user's workspaces
    const userWorkspaces = await workspaceService.getByUserId(dbUser.id);
    let actualWorkspaceId = workspaceId;
    
    if (!actualWorkspaceId || actualWorkspaceId === 'default') {
      if (userWorkspaces && userWorkspaces.length > 0) {
        const defaultWorkspace = userWorkspaces.find(w => w.isDefault) || userWorkspaces[0];
        actualWorkspaceId = defaultWorkspace.id;
      } else {
        return NextResponse.json({ error: 'No workspace found for user' }, { status: 404 });
      }
    }

    // Get learning paths for the workspace
    const learningPaths = await learningPathService.getByUserId(dbUser.id);
    
    // Filter by workspace if specified
    const filteredPaths = actualWorkspaceId 
      ? learningPaths.filter(path => path.workspaceId === actualWorkspaceId)
      : learningPaths;

    console.log(`Found ${filteredPaths.length} learning paths for user ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      learningPaths: filteredPaths
    });

  } catch (error: any) {
    console.error('Error in GET /api/dashboard/learning-paths:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch learning paths', details: error.message },
      { status: 500 }
    );
  }
}
