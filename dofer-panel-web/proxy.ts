import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname

  // Define public routes (don't need authentication)
  const isPublicRoute = path === '/login' || path === '/' || path.startsWith('/track/')

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Protected routes (dashboard)
  const isProtectedRoute = path.startsWith('/dashboard')

  // In development mode, bypass authentication for dashboard
  if (isProtectedRoute && process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // Check for session token (Supabase)
  const token = request.cookies.get('sb-access-token')?.value ||
                request.cookies.get('sb-localhost-auth-token')?.value ||
                // Supabase JS v2 stores session in cookies with project ref
                [...request.cookies.getAll()].find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.value

  // Redirect to login if accessing protected route without token
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
