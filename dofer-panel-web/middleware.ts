import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface SupabaseSession {
  access_token?: string
}

interface JwtPayload {
  exp?: number
  role?: string
  app_metadata?: {
    role?: string
  }
  user_metadata?: {
    role?: string
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function extractAccessToken(rawValue?: string): string | undefined {
  if (!rawValue) return undefined

  const decoded = safeDecodeURIComponent(rawValue).trim()
  if (!decoded) return undefined

  if (decoded.split('.').length === 3) {
    return decoded
  }

  try {
    const parsed = JSON.parse(decoded)

    if (typeof parsed === 'string' && parsed.split('.').length === 3) {
      return parsed
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') {
          const token = (item as SupabaseSession).access_token
          if (typeof token === 'string' && token.split('.').length === 3) {
            return token
          }
        }
      }
    }

    if (parsed && typeof parsed === 'object') {
      const direct = (parsed as SupabaseSession).access_token
      if (typeof direct === 'string' && direct.split('.').length === 3) {
        return direct
      }

      const currentSession = (parsed as { currentSession?: SupabaseSession }).currentSession
      if (currentSession?.access_token && currentSession.access_token.split('.').length === 3) {
        return currentSession.access_token
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const json = atob(padded)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

function extractUserRole(payload: JwtPayload): string | undefined {
  return payload.app_metadata?.role || payload.user_metadata?.role || payload.role
}

export function middleware(request: NextRequest) {
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
  const rawToken = request.cookies.get('sb-access-token')?.value ||
                   request.cookies.get('sb-localhost-auth-token')?.value ||
                   // Supabase JS v2 stores session in cookies with project ref
                   [...request.cookies.getAll()].find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.value
  const token = extractAccessToken(rawToken)

  // Redirect to login if accessing protected route without token
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isProtectedRoute && token) {
    const payload = decodeJwtPayload(token)
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const nowInSeconds = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp <= nowInSeconds) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const requiredRole = process.env.DASHBOARD_REQUIRED_ROLE?.trim().toLowerCase()
    if (requiredRole) {
      const userRole = extractUserRole(payload)?.toLowerCase()
      if (!userRole || userRole !== requiredRole) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
