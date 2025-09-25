import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { workspaceService, userService } from '@/lib/tidb-service';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated services with JWT
    const { user } = await getAuthenticatedServices(req);
    
    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    // Get workspaces for this user from TiDB
    const workspaces = await workspaceService.getByUserId(dbUser.id);
    
    return NextResponse.json(workspaces);
  } catch (error: any) {
    console.error('Get workspaces error:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: 'Failed to get workspaces' }, { status: 500 });
  }
}

// TODO: Replace custom workspace logic with Appwrite Databases and Account for workspace CRUD operations
// import { Client, Databases, Account } from "appwrite";
// const client = new Client();
// client.setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!);
// const databases = new Databases(client);
// const account = new Account(client);
// Use these for workspace CRUD operations instead of custom logic 