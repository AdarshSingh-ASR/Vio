import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { dashboardItemService, userService } from '@/lib/tidb-service';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const id = params.id;
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const item = await dashboardItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    // Verify ownership
    if (item.createdBy !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(item);
  } catch (error: any) {
    console.error('Get item error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const id = params.id;
    
    console.log("DELETE /api/dashboard/items/[id] - User:", user.email, "Item:", id);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Verify ownership first and get item info
    console.log("Getting item from TiDB...");
    const item = await dashboardItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    console.log("Item found:", item.fileType, item.title);
    
    if (item.createdBy !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Delete the item from TiDB
    console.log("Deleting item from TiDB...");
    await dashboardItemService.delete(id);
    
    console.log("Dashboard item deleted successfully:", id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      type: error.type,
      response: error.response
    });
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to delete item', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    const userId = user.$id;
    const id = params.id;
    const body = await req.json();

    console.log("PATCH /api/dashboard/items/[id] - User:", user.email, "Item:", id);

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership before updating
    const item = await dashboardItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (item.createdBy !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only update fields that are present in the body
         const updateData: Record<string, any> = {};
         if ('favorite' in body) updateData.favorite = body.favorite;
         if ('folderId' in body) updateData.folderId = body.folderId;
         if ('title' in body) updateData.title = body.title;
         if ('name' in body) updateData.displayName = body.name; // Map name to displayName for rename
         if ('displayName' in body) updateData.displayName = body.displayName; // Update displayName for rename

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No values to set' }, { status: 400 });
    }

    const updatedItem = await dashboardItemService.update(id, updateData);
    
    console.log("Dashboard item updated successfully:", id);
    
    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error: any) {
    console.error('Update error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to update item', details: error.message }, { status: 500 });
  }
}
