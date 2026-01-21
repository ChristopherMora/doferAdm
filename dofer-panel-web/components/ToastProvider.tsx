'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type: Toast['type'], duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'], duration = 3000) => {
    const id = Math.random().toString(36).substring(7)
    const newToast = { id, message, type, duration }
    
    setToasts(prev => [...prev, newToast])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
    }
  }

  const getColor = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400'
      case 'error': return 'bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400'
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400'
      case 'info': return 'bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300 ${getColor(toast.type)}`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="text-xl">{getIcon(toast.type)}</span>
            <span className="font-medium">{toast.message}</span>
            <button
              className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
              onClick={() => removeToast(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
