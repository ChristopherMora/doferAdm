'use client'

import { type ReactNode, useEffect } from 'react'
import {
  X,
} from 'lucide-react'

export function DialogBackdrop({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

export function DialogHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string
  title: string
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        title="Cerrar"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
