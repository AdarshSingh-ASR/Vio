import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { 
  dashboardItemService, 
  folderService, 
  workspaceService, 
  userService,
  itemFolderService
} from '@/lib/tidb-service';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/dashboard/items - Starting request");
    
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(request);
    
    console.log("Authenticated user:", user.email);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const folderId = searchParams.get('folderId');
    
    console.log("Query params - workspaceId:", workspaceId, "folderId:", folderId);
    
    let items = [];
    
    if (folderId && folderId !== 'undefined') {
      // Get items for a specific folder
      console.log("Getting items for folder:", folderId);
      
      // Verify folder ownership
      const folder = await folderService.getById(folderId);
      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        );
      }
      
      // Get user's workspace to verify access
      let workspaces = await workspaceService.getByUserId(dbUser.id);
      let userWorkspaceId: string;
      
      console.log("User workspaces:", workspaces?.map(w => ({ id: w.id, name: w.name })));
      console.log("Folder workspace ID:", folder.workspaceId);
      
      if (!workspaces || workspaces.length === 0) {
        console.log("No workspaces found for user");
        return NextResponse.json(
          { error: 'User workspace not found' },
          { status: 403 }
        );
      } else {
        userWorkspaceId = workspaces[0].id;
        console.log("Using workspace ID:", userWorkspaceId);
      }
      
      // Fix: If folder has no workspaceId (null/undefined), update it to user's workspace
      if (!folder.workspaceId) {
        console.log("Folder has no workspace ID, updating to user workspace:", userWorkspaceId);
        await folderService.update(folderId, { workspaceId: userWorkspaceId });
        // Re-fetch the folder with updated workspaceId
        const updatedFolder = await folderService.getById(folderId);
        if (updatedFolder) {
          folder.workspaceId = updatedFolder.workspaceId;
        }
      }
      
      if (folder.workspaceId !== userWorkspaceId) {
        console.log("Access denied: folder workspace", folder.workspaceId, "!= user workspace", userWorkspaceId);
        return NextResponse.json(
          { error: 'Access denied to folder' },
          { status: 403 }
        );
      }
      
      console.log("Access granted to folder");
      
      // Get items that belong to this folder using proper relationship
      items = await dashboardItemService.getByFolderId(folderId);
      
      console.log(`Found ${items.length} items in folder`);
    } else if (workspaceId && workspaceId !== 'undefined') {
      // Get items for a specific workspace
      console.log("Getting items for workspace:", workspaceId);
      
      let actualWorkspaceId = workspaceId;
      
      // Handle "default" workspace by finding user's default workspace
      if (workspaceId === 'default') {
        const userWorkspaces = await workspaceService.getByUserId(dbUser.id);
        if (userWorkspaces && userWorkspaces.length > 0) {
          // Use the first workspace (most recent) or find default one
          const defaultWorkspace = userWorkspaces.find(w => w.isDefault) || userWorkspaces[0];
          actualWorkspaceId = defaultWorkspace.id;
          console.log("Using default workspace ID:", actualWorkspaceId);
        } else {
          return NextResponse.json(
            { error: 'No workspace found for user' },
            { status: 404 }
          );
        }
      } else {
        // Verify workspace belongs to user
        const workspace = await workspaceService.getById(workspaceId);
        if (!workspace || workspace.userId !== dbUser.id) {
          return NextResponse.json(
            { error: 'Workspace not found or access denied' },
            { status: 403 }
          );
        }
      }
      
      items = await dashboardItemService.getAllByWorkspaceId(actualWorkspaceId);
      console.log(`Found ${items.length} items in workspace`);
    } else {
      // Get all items for the user
      console.log("Getting all items for user");
      items = await dashboardItemService.getAllByUserId(dbUser.id);
      console.log(`Found ${items.length} total items`);
    }
    
    console.log(`Found ${items.length} total dashboard items`);
    
    // Transform TiDB items to match frontend interface
           const transformedItems = items.map(item => ({
             id: item.id,
             $id: item.id, // For compatibility with existing frontend
             type: item.fileType === 'link' ? 'link' : 'file',
             name: item.displayName, // Use displayName for display
             displayName: item.displayName, // Use displayName for display
             title: item.title, // Keep original title for reference
             url: item.fileUrl,
             content: item.fileType === 'link' ? (item.previewImageUrl || item.content) : item.content,
             extractedContent: item.content,
             contentType: item.fileType,
             previewUrl: item.fileType?.startsWith('image/') ? item.fileUrl : (item.fileType === 'link' ? item.previewImageUrl : undefined),
             favorite: false, // TODO: Implement favorites functionality
             fileType: item.fileType,
             description: item.description,
             fileSize: item.fileSize,
             appwriteFileId: item.appwriteFileId,
             appwriteBucketId: item.appwriteBucketId,
             workspaceId: item.workspaceId,
             createdBy: item.createdBy,
             createdAt: item.createdAt,
             updatedAt: item.updatedAt
           }));
    
    return NextResponse.json({
      success: true,
      items: transformedItems
    });
    
  } catch (error: any) {
    console.error('Error in GET /api/dashboard/items:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch dashboard items', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/dashboard/items - Starting request");
    
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(request);
    
    console.log("Authenticated user:", user.email);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { 
      title, 
      description, 
      content, 
      fileType, 
      fileSize, 
      fileUrl, 
      appwriteFileId, 
      appwriteBucketId, 
      workspaceId 
    } = body;
    
    console.log("Creating dashboard item:", { title, workspaceId });
    
    // Verify workspace belongs to user
    const workspace = await workspaceService.getById(workspaceId);
    if (!workspace || workspace.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }
    
    // Create new dashboard item
    const newItem = await dashboardItemService.create({
      title,
      displayName: title, // Set displayName as copy of title initially
      description,
      content,
      fileType,
      fileSize,
      fileUrl,
      appwriteFileId,
      appwriteBucketId,
      workspaceId,
      createdBy: dbUser.id,
    });
    
    console.log("Created dashboard item:", newItem.id);
    
    return NextResponse.json({
      success: true,
      item: newItem
    });
    
  } catch (error: any) {
    console.error('Error in POST /api/dashboard/items:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create dashboard item', details: error.message },
      { status: 500 }
    );
  }
}