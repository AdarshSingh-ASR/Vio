import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = (pathname: string): boolean => {
  const protectedPatterns = ["/dashboard", "/api/dashboard", "/api/user", "/api/payment", "/payment"];
  return protectedPatterns.some((pattern) => pathname.startsWith(pattern));
};

// Navigation guard only. Every protected API still validates the Appwrite JWT
// and resource ownership at the handler boundary.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.includes(".") ||
    pathname === "/" ||
    !isProtectedRoute(pathname)
  ) return NextResponse.next();

  if (!request.cookies.get("appwrite-session")) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|auth/sign-in|auth/sign-up|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
