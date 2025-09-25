import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, researchQueryService, workspaceService } from '@/lib/tidb-service';

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

    // Get research queries for the user
    const researchQueries = await researchQueryService.getByUserId(dbUser.id);
    
    // Filter by workspace if specified
    const filteredQueries = actualWorkspaceId 
      ? researchQueries.filter(query => query.workspaceId === actualWorkspaceId)
      : researchQueries;

    console.log(`Found ${filteredQueries.length} research queries for user ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      researchQueries: filteredQueries
    });

  } catch (error: any) {
    console.error('Error in GET /api/dashboard/research-queries:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch research queries', details: error.message },
      { status: 500 }
    );
  }
}
