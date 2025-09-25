import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { userService } from '@/lib/tidb-service';
import { storeMemory } from '@/lib/mem0';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/user - Starting JWT authentication');
    
    // Get authenticated services with JWT
    const { databases, user } = await getAuthenticatedServices(request);
    
    console.log('User authenticated:', user.email);
    
    // Transform user data for frontend compatibility
    const userData = {
      id: user.$id,
      email: user.email,
      firstName: user.name.split(' ')[0] || user.name,
      lastName: user.name.split(' ').slice(1).join(' ') || '',
      username: user.name,
      imageUrl: null, // Appwrite doesn't have built-in avatar URLs
    };
    
    // Check if user exists in TiDB database
    let existingUser = await userService.getByAppwriteUserId(user.$id);

    if (!existingUser) {
      // Create new user in TiDB database
      existingUser = await userService.create({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        imageUrl: userData.imageUrl || undefined,
        appwriteUserId: user.$id,
      });
    } else {
      // Update existing user in TiDB
      existingUser = await userService.update(existingUser.id, {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        imageUrl: userData.imageUrl || undefined,
      });
    }

    // Store user access as memory for AI personalization
    try {
      await storeMemory(user.$id, [
        { 
          role: 'user', 
          content: [{ 
            type: 'text', 
            text: `User ${userData.firstName} ${userData.lastName} accessed their profile` 
          }] 
        }
      ], {
        type: 'user_access',
        email: userData.email
      });
    } catch (memoryError) {
      console.error('Memory storage error:', memoryError);
      // Don't fail the request if memory storage fails
    }

    return NextResponse.json(userData);
    
  } catch (error: any) {
    console.error('Error in GET /api/user:', error);
    
    // Handle authentication errors
    if (error.message?.includes('JWT') || error.message?.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required', details: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user data', details: error.message },
      { status: 500 }
    );
  }
}

// TODO: Integrate Appwrite Account service for additional user management features
// The current implementation uses Appwrite for auth and syncs user data to Appwrite database
// Future: Use Appwrite Account service for enhanced user management capabilities

// TODO: Replace custom user logic with Appwrite Account for user management and auth
// import { Client, Account } from "appwrite";
// const client = new Client();
// client.setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!);
// const account = new Account(client);
// Use these for user CRUD operations instead of custom logic 