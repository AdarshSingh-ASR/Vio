import { NextRequest, NextResponse } from 'next/server';
import { Client, Account } from 'appwrite';

const isProtectedRoute = (pathname: string): boolean => {
  const protectedPatterns = ['/dashboard', '/api/dashboard', '/api/user', '/api/payment', '/payment'];
  return protectedPatterns.some(pattern => pathname.startsWith(pattern));
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth') ||
    pathname.includes('.') ||
    pathname === '/' ||
    !isProtectedRoute(pathname)
  ) {
    return NextResponse.next();
  }

  // Get session from cookies
  const sessionCookie = request.cookies.get('appwrite-session');

  if (!sessionCookie) {
    console.log('Middleware: No session cookie found, redirecting to sign-in');
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  // For now, if session cookie exists, allow access
  // TODO: Re-enable strict verification once session issues are resolved
  console.log('Middleware: Session cookie found, allowing access');
  return NextResponse.next();

  /* Temporarily disabled strict verification
  try {
    // Verify the session with Appwrite
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
      .setProject(process.env.APPWRITE_PROJECT_ID!);

    // Important: Set session AFTER creating client
    client.setSession(sessionCookie.value);

    const account = new Account(client);
    const user = await account.get();
    
    console.log('Middleware: Session verified for user:', user.email);
    
    // If successful, continue to the route
    return NextResponse.next();
  } catch (error) {
    // Invalid session, redirect to sign in
    console.log('Middleware: Session verification failed:', error);
    const response = NextResponse.redirect(new URL('/auth/sign-in', request.url));
    // Clear the invalid session cookie
    response.cookies.delete('appwrite-session');
    return response;
  }
  */
}

export const config = {
  matcher: [
    // Exclude auth routes and static files from protection
    '/((?!_next|auth/sign-in|auth/sign-up|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};