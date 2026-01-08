const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

interface RequestConfig extends RequestInit {
  token?: string
}

async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { token, ...fetchConfig } = config

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchConfig,
    headers,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'API request failed')
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    apiRequest<T>(endpoint, { method: 'GET', token }),
  
  post: <T>(endpoint: string, data?: unknown, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
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
