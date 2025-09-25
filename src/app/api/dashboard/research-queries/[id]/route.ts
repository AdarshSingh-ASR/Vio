import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';
import { userService, researchQueryService } from '@/lib/tidb-service';

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

    const researchQueryId = params.id;

    // Check if research query exists and belongs to user
    const researchQuery = await researchQueryService.getById(researchQueryId);
    if (!researchQuery) {
      return NextResponse.json({ error: 'Research query not found' }, { status: 404 });
    }

    if (researchQuery.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized to delete this research query' }, { status: 403 });
    }

    // Delete the research query
    await researchQueryService.delete(researchQueryId);

    console.log(`Deleted research query ${researchQueryId} for user ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      message: 'Research query deleted successfully'
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/dashboard/research-queries/[id]:', error);
    
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete research query', details: error.message },
      { status: 500 }
    );
  }
}
