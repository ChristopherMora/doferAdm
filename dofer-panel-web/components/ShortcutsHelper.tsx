'use client'

import { useState, useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const shortcuts: Shortcut[] = [
  // Navegación
  { keys: ['Ctrl', '1'], description: 'Dashboard', category: 'Navegación' },
  { keys: ['Ctrl', '2'], description: 'Órdenes', category: 'Navegación' },
  { keys: ['Ctrl', '3'], description: 'Cotizaciones', category: 'Navegación' },
  { keys: ['Ctrl', '4'], description: 'Clientes', category: 'Navegación' },
  { keys: ['Ctrl', '5'], description: 'Kanban', category: 'Navegación' },
  { keys: ['Ctrl', '6'], description: 'Estadísticas', category: 'Navegación' },
  
  // Acciones
  { keys: ['Ctrl', 'N'], description: 'Nueva orden', category: 'Acciones' },
  { keys: ['Ctrl', 'K'], description: 'Búsqueda rápida', category: 'Acciones' },
  { keys: ['/'], description: 'Enfocar búsqueda', category: 'Acciones' },
  { keys: ['Ctrl', 'B'], description: 'Toggle sidebar', category: 'Acciones' },
  { keys: ['?'], description: 'Mostrar atajos', category: 'Acciones' },
  { keys: ['Esc'], description: 'Cerrar modal/búsqueda', category: 'Acciones' },
  
  // Órdenes
  { keys: ['P'], description: 'Imprimir orden actual', category: 'Órdenes' },
  { keys: ['E'], description: 'Editar orden actual', category: 'Órdenes' },
  { keys: ['D'], description: 'Eliminar orden actual', category: 'Órdenes' },
  
  // Vista
  { keys: ['Ctrl', 'D'], description: 'Toggle modo oscuro', category: 'Vista' },
  { keys: ['Ctrl', '+'], description: 'Zoom in', category: 'Vista' },
  { keys: ['Ctrl', '-'], description: 'Zoom out', category: 'Vista' },
]

export default function ShortcutsHelper() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? para abrir ayuda
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setIsOpen(true)
        }
      }
      // Esc para cerrar
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 z-40"
        title="Atajos de teclado (Presiona ?)"
      >
        <Keyboard className="h-5 w-5" />
      </button>
    )
  }

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Keyboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Atajos de Teclado</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Mejora tu productividad con estos shortcuts
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-6 space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-background border border-border rounded shadow-sm">
                              {key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              💡 Presiona <kbd className="px-2 py-0.5 bg-background border border-border rounded text-xs font-mono">?</kbd> en cualquier momento para ver esta ayuda
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
