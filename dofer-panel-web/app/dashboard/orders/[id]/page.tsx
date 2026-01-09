'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import ChangeStatusModal from '../ChangeStatusModal'
import AssignOperatorModal from '../AssignOperatorModal'

interface Order {
  id: string
  public_id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  product_name: string
  quantity: number
  status: string
  priority: string
  platform: string
  notes: string
  assigned_to: string
  assigned_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [params.id])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<Order>(`/orders/${params.id}`)
      setOrder(response)
    } catch (err: any) {
      setError(err.message || 'Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      new: 'bg-yellow-100 text-yellow-800',
      printing: 'bg-purple-100 text-purple-800',
      post: 'bg-blue-100 text-blue-800',
      packed: 'bg-indigo-100 text-indigo-800',
      ready: 'bg-green-100 text-green-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800',
    }
    return badges[priority] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando orden...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Orden no encontrada'}</p>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            ← Volver a órdenes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="text-indigo-600 hover:text-indigo-700 mb-2 inline-block"
            >
              ← Volver a órdenes
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {order.order_number}
            </h1>
          </div>
          <div className="flex gap-3">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadge(order.status)}`}>
              {order.status}
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityBadge(order.priority)}`}>
              Prioridad: {order.priority}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Información del Cliente
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="text-base font-medium text-gray-900">{order.customer_name}</p>
            </div>
            {order.customer_email && (
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-base text-gray-900">{order.customer_email}</p>
              </div>
            )}
            {order.customer_phone && (
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="text-base text-gray-900">{order.customer_phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Plataforma</p>
              <p className="text-base text-gray-900 capitalize">{order.platform}</p>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Detalles del Pedido
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Producto</p>
              <p className="text-base font-medium text-gray-900">{order.product_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cantidad</p>
              <p className="text-base text-gray-900">{order.quantity} unidades</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ID Público (Tracking)</p>
              <p className="text-xs font-mono text-gray-600">{order.public_id}</p>
            </div>
            {order.notes && (
              <div>
                <p className="text-sm text-gray-500">Notas</p>
                <p className="text-base text-gray-900">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Fechas
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Creada</p>
              <p className="text-base text-gray-900">
                {new Date(order.created_at).toLocaleString('es-MX', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Última actualización</p>
              <p className="text-base text-gray-900">
                {new Date(order.updated_at).toLocaleString('es-MX', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </p>
            </div>
            {order.completed_at && (
              <div>
                <p className="text-sm text-gray-500">Completada</p>
                <p className="text-base text-gray-900">
                  {new Date(order.completed_at).toLocaleString('es-MX', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Assignment */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Asignación
          </h2>
          <div className="space-y-3">
            {order.assigned_to ? (
              <>
                <div>
                  <p className="text-sm text-gray-500">Asignado a</p>
                  <p className="text-base text-gray-900">{order.assigned_to}</p>
                </div>
                {order.assigned_at && (
                  <div>
                    <p className="text-sm text-gray-500">Fecha de asignación</p>
                    <p className="text-base text-gray-900">
                      {new Date(order.assigned_at).toLocaleString('es-MX', {
                        dateStyle: 'long',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 italic">No asignada</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Acciones
        </h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsStatusModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Cambiar Estado
          </button>
          <button 
            onClick={() => setIsAssignModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Asignar Operador
          </button>
          <a
            href={`/track/${order.public_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Ver Tracking Público →
          </a>
        </div>
      </div>

      {/* Modals */}
      <ChangeStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSuccess={loadOrder}
        orderId={order.id}
        currentStatus={order.status}
      />
      <AssignOperatorModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={loadOrder}
        orderId={order.id}
        currentAssignee={order.assigned_to}
      />
    </div>
  )
}
