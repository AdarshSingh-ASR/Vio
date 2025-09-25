import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServices } from "@/lib/appwrite-server";
import { 
  folderService,
  userService,
  workspaceService,
  itemFolderService
} from '@/lib/tidb-service';

export async function DELETE(req: NextRequest, { params }: { params: { id: string, itemId: string } }) {
  try {
    console.log('🗑️ Remove item from folder API hit:', params);
    
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    const folderId = params.id;
    const itemId = params.itemId;
    
    // Get user from TiDB
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('📂 Removing item from folder:', { folderId, itemId, userId: dbUser.id });
    
    // Get the folder to verify ownership
    const folder = await folderService.getById(folderId);
    if (!folder) {
      console.log('🚫 Folder not found:', folderId);
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
    
    // Verify ownership
    if (folder.workspaceId !== userWorkspaceId) {
      console.log('🚫 Permission denied - folder workspaceId:', folder.workspaceId, 'user workspaceId:', userWorkspaceId);
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Get current folder items count
    const currentItemFolders = await itemFolderService.getByFolderId(folderId);
    console.log('📋 Current folder items:', currentItemFolders.length);
    
    // Find the specific item-folder relationship to delete
    const itemFolderToDelete = currentItemFolders.find(itemFolder => itemFolder.itemId === itemId);
    if (!itemFolderToDelete) {
      console.log('🚫 Item not found in folder:', itemId);
      return NextResponse.json({ error: 'Item not found in folder' }, { status: 404 });
    }
    
    // Delete the item-folder relationship
    await itemFolderService.delete(itemFolderToDelete.id);
    
    console.log('✅ Item removed from folder successfully');
    
    return NextResponse.json({ 
      success: true,
      message: 'Item removed from folder',
      removedItemId: itemId,
      folderId: folderId,
      remainingItemsCount: currentItemFolders.length - 1
    });
    
  } catch (error: any) {
    console.error('❌ Remove item from folder error:', error);
    return NextResponse.json({ 
      error: 'Failed to remove item from folder',
      details: error.message 
    }, { status: 500 });
  }

}
