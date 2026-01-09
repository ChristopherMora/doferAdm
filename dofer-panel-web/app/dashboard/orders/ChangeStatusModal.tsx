'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api'

interface ChangeStatusModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  orderId: string
  currentStatus: string
}

export default function ChangeStatusModal({ isOpen, onClose, onSuccess, orderId, currentStatus }: ChangeStatusModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState(currentStatus)

  const statusOptions = [
    { value: 'new', label: 'Nueva', description: 'Pedido recién creado' },
    { value: 'printing', label: 'En Impresión', description: 'Actualmente en impresora 3D' },
    { value: 'post', label: 'Post-proceso', description: 'Limpieza y acabados' },
    { value: 'packed', label: 'Empacada', description: 'Lista para envío' },
    { value: 'ready', label: 'Lista para Entrega', description: 'Preparada para el cliente' },
    { value: 'delivered', label: 'Entregada', description: 'Cliente recibió el pedido' },
    { value: 'cancelled', label: 'Cancelada', description: 'Pedido cancelado' },
  ]

  // Valid transitions based on domain logic
  const validTransitions: Record<string, string[]> = {
    new: ['printing', 'cancelled'],
    printing: ['post', 'cancelled'],
    post: ['packed', 'cancelled'],
    packed: ['ready', 'cancelled'],
    ready: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  }

  const availableStatuses = statusOptions.filter(option => 
    validTransitions[currentStatus]?.includes(option.value) || option.value === currentStatus
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newStatus === currentStatus) {
      onClose()
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Cambiar Estado</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona el nuevo estado:
            </label>
            <div className="space-y-2">
              {availableStatuses.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    newStatus === option.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${option.value === currentStatus ? 'opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={newStatus === option.value}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={option.value === currentStatus}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                    {option.value === currentStatus && (
                      <div className="text-xs text-indigo-600 mt-1">Estado actual</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {availableStatuses.length <= 1 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              No hay transiciones válidas desde el estado actual.
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || newStatus === currentStatus || availableStatuses.length <= 1}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Actualizando...' : 'Cambiar Estado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
