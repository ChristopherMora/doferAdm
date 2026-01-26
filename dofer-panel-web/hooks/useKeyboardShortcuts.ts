import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutConfig {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
  category?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si está en un input, textarea o contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

// Hook para shortcuts globales del dashboard
export function useGlobalShortcuts() {
  const router = useRouter()

  const shortcuts: ShortcutConfig[] = [
    // Navegación
    { key: '1', ctrlKey: true, action: () => router.push('/dashboard'), description: 'Ir a Dashboard', category: 'Navegación' },
    { key: '2', ctrlKey: true, action: () => router.push('/dashboard/orders'), description: 'Ir a Órdenes', category: 'Navegación' },
    { key: '3', ctrlKey: true, action: () => router.push('/dashboard/quotes'), description: 'Ir a Cotizaciones', category: 'Navegación' },
    { key: '4', ctrlKey: true, action: () => router.push('/dashboard/customers'), description: 'Ir a Clientes', category: 'Navegación' },
    { key: '5', ctrlKey: true, action: () => router.push('/dashboard/kanban'), description: 'Ir a Kanban', category: 'Navegación' },
    { key: '6', ctrlKey: true, action: () => router.push('/dashboard/stats'), description: 'Ir a Estadísticas', category: 'Navegación' },
  ]

  return shortcuts
}

// Hook para mostrar ayuda de atajos
export function useShortcutHelp(shortcuts: ShortcutConfig[]) {
  const [isOpen, setIsOpen] = useCallback(() => {
    // Lógica para mostrar modal de ayuda
  }, [])

  return { isOpen, setIsOpen, shortcuts }
}
