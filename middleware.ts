import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page without authentication
  if (pathname === '/' || pathname === '/leaderboard' || pathname.startsWith('/login')) {
    return NextResponse.next()
  }

  // Check for admin and participant routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard')) {
    // In production, validate JWT token here
    // Check SEB headers if needed
    const sebHeader = request.headers.get('X-SafeExamBrowser-ConfigKeyHash')
    
    // For now, just pass through - implement actual validation in production
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
