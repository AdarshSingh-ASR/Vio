import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { folderService, userService, itemFolderService, workspaceService } from '@/lib/tidb-service';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get or create a default workspace for the user
    let workspaces = await workspaceService.getByUserId(dbUser.id);
    let workspaceId: string;
    
    if (!workspaces || workspaces.length === 0) {
      // Create default workspace if none exists
      const newWorkspace = await workspaceService.create({
        name: 'Default Workspace',
        description: 'Default workspace for user folders',
        userId: dbUser.id,
        isDefault: true
      });
      workspaceId = newWorkspace.id;
    } else {
      workspaceId = workspaces[0].id;
    }

    const folders = await folderService.getByWorkspaceId(workspaceId);

    // Transform TiDB folder data to match frontend expectations
    const transformedFolders = folders.map(folder => ({
      $id: folder.id,
      id: folder.id,
      name: folder.name,
      description: folder.description,
      workspaceId: folder.workspaceId,
      parentFolderId: folder.parentFolderId,
      createdBy: folder.createdBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    }));

    return NextResponse.json(transformedFolders);
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    
    const { name, itemIds } = await req.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create a default workspace for the user
    let workspaces = await workspaceService.getByUserId(dbUser.id);
    let workspaceId: string;
    
    if (!workspaces || workspaces.length === 0) {
      // Create default workspace if none exists
      const newWorkspace = await workspaceService.create({
        name: 'Default Workspace',
        description: 'Default workspace for user folders',
        userId: dbUser.id,
        isDefault: true
      });
      workspaceId = newWorkspace.id;
    } else {
      workspaceId = workspaces[0].id;
    }

    const newFolder = await folderService.create({
      name,
      description: `Folder created by ${dbUser.email}`,
      workspaceId: workspaceId,
      createdBy: dbUser.id
    });

    // If itemIds are provided, create item-folder relationships
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      const itemFolderPromises = itemIds.map((itemId: string) => 
        itemFolderService.create({
          itemId,
          folderId: newFolder.id
        })
      );
      
      await Promise.all(itemFolderPromises);
    }

    return NextResponse.json(newFolder);
  } catch (error: any) {
    console.error('Error creating folder:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    
    const { folderId, itemIds } = await req.json();
    
    if (!folderId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Missing folderId or itemIds' }, { status: 400 });
    }
    
    // Get user from TiDB
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check that the folder belongs to the user
    const folder = await folderService.getById(folderId);
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
    
    // Create item-folder relationships (skip duplicates by checking existing ones)
    const existingItemFolders = await itemFolderService.getByFolderId(folderId);
    const existingItemIds = existingItemFolders.map(link => link.itemId);
    const newItemIds = itemIds.filter((itemId: string) => !existingItemIds.includes(itemId));
    
    if (newItemIds.length > 0) {
      const itemFolderPromises = newItemIds.map((itemId: string) => 
        itemFolderService.create({
          itemId,
          folderId
        })
      );
      
      await Promise.all(itemFolderPromises);
    }
    
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