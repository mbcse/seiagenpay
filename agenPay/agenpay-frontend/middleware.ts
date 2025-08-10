import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define protected routes
const protectedRoutes = ['/dashboard', '/api/chat']
const authRoutes = ['/auth/login']
const publicRoutes = ['/auth/notion-callback', '/landing', '/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '')

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Check if the route is an auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Check if the route is a public route (like OAuth callbacks, landing, and root)
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Allow public routes without authentication (including root and landing for logged-in users)
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // If user is not authenticated and trying to access protected route
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If user is authenticated and trying to access auth routes
  if (isAuthRoute && token) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 