import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedServices } from '@/lib/appwrite-server';
import { userService } from '@/lib/tidb-service';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedServices(request);
    
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

    return NextResponse.json(userData);
    
  } catch (error: unknown) {
    console.error('User profile synchronization failed', { code: error instanceof Error ? error.name : 'UNKNOWN' });
    
    // Handle authentication errors
    const message = error instanceof Error ? error.message : '';
    if (message.includes('JWT') || message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
