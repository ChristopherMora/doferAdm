const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1'
const DEV_TEST_TOKEN = 'test-auth-token'

type QueryValue = string | number | boolean | null | undefined

interface RequestConfig extends RequestInit {
  token?: string
  params?: Record<string, QueryValue>
}

function parseSupabaseToken(rawValue: string): string | undefined {
  if (!rawValue) return undefined

  try {
    const parsed = JSON.parse(rawValue)

    if (typeof parsed === 'string' && parsed.trim()) {
      return parsed
    }

    if (parsed && typeof parsed === 'object') {
      const directToken = (parsed as { access_token?: unknown }).access_token
      if (typeof directToken === 'string' && directToken.trim()) {
        return directToken
      }

      const currentSession = (parsed as { currentSession?: { access_token?: unknown } }).currentSession
      if (currentSession && typeof currentSession.access_token === 'string' && currentSession.access_token.trim()) {
        return currentSession.access_token
      }

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const token = (item as { access_token?: unknown }).access_token
            if (typeof token === 'string' && token.trim()) {
              return token
            }
          }
        }
      }
    }
  } catch {
    // El valor puede venir como texto plano en algunos entornos de desarrollo.
    if (rawValue.trim()) {
      return rawValue.trim()
    }
  }

  return undefined
}

function getCookieToken(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))

  if (!match) return undefined

  const value = decodeURIComponent(match.split('=').slice(1).join('=')).trim()
  return value || undefined
}

function getProjectCookieToken(): string | undefined {
  if (typeof document === 'undefined') return undefined

  const match = document.cookie
    .split('; ')
    .find((entry) => {
      const name = entry.split('=')[0]
      return name.startsWith('sb-') && name.endsWith('-auth-token')
    })

  if (!match) return undefined

  const value = decodeURIComponent(match.split('=').slice(1).join('=')).trim()
  return value || undefined
}

function getBrowserAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined

  const explicitTestToken = localStorage.getItem('test-token')
  if (explicitTestToken && explicitTestToken.trim()) {
    return explicitTestToken.trim()
  }

  const cookieToken =
    getCookieToken('sb-access-token') ||
    getCookieToken('sb-localhost-auth-token') ||
    getProjectCookieToken()
  if (cookieToken) {
    const parsedCookieToken = parseSupabaseToken(cookieToken)
    if (parsedCookieToken) {
      return parsedCookieToken
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue

    const rawValue = localStorage.getItem(key)
    if (!rawValue) continue

    const token = parseSupabaseToken(rawValue)
    if (token) return token
  }

  return undefined
}

async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { token, params, ...fetchConfig } = config

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const resolvedToken =
    token ||
    getBrowserAuthToken() ||
    (process.env.NODE_ENV === 'development' ? DEV_TEST_TOKEN : undefined)

  if (resolvedToken) {
    headers['Authorization'] = `Bearer ${resolvedToken}`
  }

  // Build query string from params
  let url = `${API_URL}${endpoint}`
  if (params) {
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue
      queryParams.set(key, String(value))
    }
    const queryString = queryParams.toString()
    if (queryString) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}${queryString}`
    }
  }

  const response = await fetch(url, {
    ...fetchConfig,
    headers,
  })

  if (!response.ok) {
    let errorMessage = `Error ${response.status}`
    try {
      // Leer como texto primero
      const responseText = await response.text()
      // Intentar parsear como JSON
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.error || errorData.message || responseText
      } catch {
        // Si no es JSON, usar el texto directamente
        errorMessage = responseText || errorMessage
      }
    } catch (e) {
      console.error('Error reading response:', e)
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

export const apiClient = {
  get: <T>(endpoint: string, config?: { params?: Record<string, QueryValue>, token?: string }) =>
    apiRequest<T>(endpoint, { method: 'GET', ...config }),
  
  post: <T>(endpoint: string, data?: unknown, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
  
  put: <T>(endpoint: string, data?: unknown, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),
  
  patch: <T>(endpoint: string, data?: unknown, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),
  
  delete: <T>(endpoint: string, token?: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE', token }),
}
