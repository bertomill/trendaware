import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/login' || path === '/signup' || path === '/';
  
  // Get the token from cookies
  const token = request.cookies.get('auth-token')?.value || '';
  
  // Only redirect from public paths to dashboard if token exists
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Only redirect from protected paths to login if no token
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

// Configure which paths should trigger this middleware
export const config = {
  matcher: ['/', '/dashboard/:path*', '/profile/:path*', '/research/:path*', '/login', '/signup'],
}; 