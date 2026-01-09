import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname

  // Define protected routes
  const isProtectedRoute = path.startsWith('/dashboard')

  // Check for session token (Supabase or test token)
  const token = request.cookies.get('sb-access-token')?.value ||
                request.cookies.get('sb-localhost-auth-token')?.value

  // MODO PRUEBA: También permitir con localStorage test-token (se verifica en el cliente)
  // Para desarrollo, permitimos pasar si viene de login
  const isFromLogin = request.headers.get('referer')?.includes('/login')

  // Redirect to login if accessing protected route without token and not from login
  if (isProtectedRoute && !token && !isFromLogin) {
    // En desarrollo, permitir acceso temporal para pruebas
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to dashboard if accessing login with valid token
  if (path === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/track/:path*',
    '/login'
  ]
}
