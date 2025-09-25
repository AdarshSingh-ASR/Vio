import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/appwrite-server';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (user) {
      return NextResponse.json({ valid: true, user: { id: user.$id, email: user.email } });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    console.log('Session validation error:', error);
    return NextResponse.json({ valid: false }, { status: 401 });
  }
} 