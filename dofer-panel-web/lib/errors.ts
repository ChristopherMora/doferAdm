interface ErrorResponseShape {
  data?: {
    error?: string
    message?: string
  }
}

interface ErrorWithResponse {
  message?: string
  response?: ErrorResponseShape
}

export function getErrorMessage(error: unknown, fallback = 'Error inesperado'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const candidate = error as ErrorWithResponse
    const responseMessage = candidate.response?.data?.error || candidate.response?.data?.message
    if (responseMessage) return responseMessage
    if (candidate.message) return candidate.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}
