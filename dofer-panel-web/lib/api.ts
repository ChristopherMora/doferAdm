const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1'

interface RequestConfig extends RequestInit {
  token?: string
  params?: Record<string, any>
}

async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { token, params, ...fetchConfig } = config

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Use test-token for development
  const authToken = token || 'test-token'
  headers['Authorization'] = `Bearer ${authToken}`

  // Build query string from params
  let url = `${API_URL}${endpoint}`
  if (params) {
    const queryString = new URLSearchParams(params).toString()
    url = `${url}?${queryString}`
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
  get: <T>(endpoint: string, config?: { params?: Record<string, any>, token?: string }) =>
    apiRequest<T>(endpoint, { method: 'GET', ...config }),
  
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
