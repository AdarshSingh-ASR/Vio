import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { 
  folderService, 
  userService, 
  workspaceService,
  itemFolderService
} from '@/lib/tidb-service';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    const { name } = await req.json();
    
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
    
    // Get user from TiDB
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Verify ownership before updating
    const folder = await folderService.getById(params.id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    
    // Get user's workspace to verify access
    let workspaces = await workspaceService.getByUserId(dbUser.id);
    let userWorkspaceId: string;
    
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 403 });
    } else {
      userWorkspaceId = workspaces[0].id;
    }
    
    if (folder.workspaceId !== userWorkspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Update the folder
    await folderService.update(params.id, { name });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update folder error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    
    // Get user from TiDB
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Verify ownership before deleting
    const folder = await folderService.getById(params.id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
    
    // Get user's workspace to verify access
    let workspaces = await workspaceService.getByUserId(dbUser.id);
    let userWorkspaceId: string;
    
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 403 });
    } else {
      userWorkspaceId = workspaces[0].id;
    }
    
    if (folder.workspaceId !== userWorkspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Remove all item-folder links for this folder
    const itemFolders = await itemFolderService.getByFolderId(params.id);
    
    const deletePromises = itemFolders.map((itemFolder) => 
      itemFolderService.delete(itemFolder.id)
    );
    await Promise.all(deletePromises);
    
    // Delete the folder
    await folderService.delete(params.id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete folder error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
} 