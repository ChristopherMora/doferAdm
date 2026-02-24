'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface AssignOperatorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  orderId: string
  currentAssignee?: string
}

export default function AssignOperatorModal({ isOpen, onClose, onSuccess, orderId, currentAssignee }: AssignOperatorModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState(currentAssignee || '')

  // Hardcoded users from database (in production, fetch from API)
  const users = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Admin DOFER', role: 'admin' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Operador', role: 'operator' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser) {
      setError('Debes seleccionar un usuario')
      return
    }

    if (selectedUser === currentAssignee) {
      onClose()
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiClient.patch(`/orders/${orderId}/assign`, { user_id: selectedUser })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al asignar operador'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Asignar Operador</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Selecciona el operador:
            </label>
            <div className="space-y-2">
              {users.map((user) => (
                <label
                  key={user.id}
                  className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedUser === user.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="user"
                    value={user.id}
                    checked={selectedUser === user.id}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">{user.role}</div>
                    {user.id === currentAssignee && (
                      <div className="text-xs text-primary mt-1">Asignación actual</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUser || selectedUser === currentAssignee}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Asignando...' : 'Asignar Operador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
