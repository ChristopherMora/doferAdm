'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { OrderItem } from '@/types'
import ChangeStatusModal from '../ChangeStatusModal'
import AssignOperatorModal from '../AssignOperatorModal'
import OrderTimer from '@/components/OrderTimer'

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

interface HistoryEntry {
  id: string
  order_id: string
  changed_by: string
  change_type: string
  field_name: string
  old_value: string
  new_value: string
  created_at: string
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
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
      setError(null)
      const [orderData, historyData, itemsData] = await Promise.all([
        apiClient.get<Order>(`/orders/${params.id}`),
        apiClient.get<{ history: HistoryEntry[] }>(`/orders/${params.id}/history`),
        apiClient.get<{ items: OrderItem[] }>(`/orders/${params.id}/items`)
      ])
      setOrder(orderData)
      setHistory(historyData.history || [])
      setItems(itemsData.items || [])
    } catch (err: any) {
      console.error('Error loading order:', err)
      setError(err.response?.data?.error || err.message || 'Error al cargar la orden')
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

  const handleItemToggle = async (itemId: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/orders/${params.id}/items/${itemId}/status`, {
        is_completed: !currentStatus
      })
      // Actualizar el estado local
      setItems(items.map(item => 
        item.id === itemId 
          ? { ...item, is_completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : null }
          : item
      ))
    } catch (err: any) {
      console.error('Error updating item status:', err)
      alert('Error al actualizar el estado del item')
    }
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
            {(order as any).print_file && (
              <div>
                <p className="text-sm text-gray-500">Archivo de Impresión</p>
                <div className="flex items-center gap-2 mt-1">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <a 
                    href={(order as any).print_file} 
                    download={(order as any).print_file_name || 'archivo'}
                    className="text-base text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {(order as any).print_file_name}
                  </a>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">ID Público (Tracking)</p>
              <p className="text-xs font-mono text-gray-600">{order.public_id}</p>
            </div>
            {order.notes && (
              <div>
                <p className="text-sm text-gray-500">Notas</p>
                <p className="text-base text-gray-900 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        {items.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Items del Pedido ({items.filter(i => i.is_completed).length}/{items.length} completados)
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    item.is_completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => handleItemToggle(item.id, item.is_completed)}
                    className="mt-1 h-5 w-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`font-medium ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.product_name}
                        </p>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Cantidad: {item.quantity} × ${item.unit_price.toFixed(2)} = ${item.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {item.completed_at && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Completado {new Date(item.completed_at).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Delivery Deadline */}
        {(order as any).delivery_deadline && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📅 Fecha de Entrega
            </h2>
            <div className="space-y-3">
              {(() => {
                const deadline = new Date((order as any).delivery_deadline)
                const now = new Date()
                const diffTime = deadline.getTime() - now.getTime()
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
                
                let statusColor = 'bg-green-50 text-green-800 border-green-200'
                let statusIcon = '✅'
                let statusText = 'A tiempo'
                
                if (diffDays < 0) {
                  statusColor = 'bg-red-50 text-red-800 border-red-200'
                  statusIcon = '❌'
                  statusText = 'Vencida'
                } else if (diffDays === 0) {
                  statusColor = 'bg-orange-50 text-orange-800 border-orange-200'
                  statusIcon = '⚠️'
                  statusText = 'Vence hoy'
                } else if (diffDays === 1) {
                  statusColor = 'bg-yellow-50 text-yellow-800 border-yellow-200'
                  statusIcon = '⏰'
                  statusText = 'Vence mañana'
                } else if (diffDays <= 3) {
                  statusColor = 'bg-yellow-50 text-yellow-800 border-yellow-200'
                  statusIcon = '⏳'
                  statusText = 'Próxima a vencer'
                }
                
                return (
                  <>
                    <div>
                      <p className="text-sm text-gray-500">Fecha límite</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {deadline.toLocaleString('es-MX', {
                          dateStyle: 'full',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>
                    <div className={`border-2 rounded-lg p-4 ${statusColor}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium mb-1">Estado de entrega</p>
                          <p className="text-2xl font-bold">{statusIcon} {statusText}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium mb-1">Tiempo restante</p>
                          <p className="text-2xl font-bold">
                            {diffDays < 0 
                              ? `${Math.abs(diffDays)} días vencidos`
                              : diffDays === 0
                              ? `${diffHours} horas`
                              : `${diffDays} días`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

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

      {/* Timer de Producción */}
      <OrderTimer 
        orderId={order.id} 
        estimatedMinutes={(order as any).estimated_time_minutes || 0}
      />

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

      {/* Historial de Cambios */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Historial de Cambios
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-500 italic">No hay cambios registrados</p>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    {entry.change_type === 'status_change' ? '📊' : '👤'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {entry.change_type === 'status_change' ? 'Cambio de estado' : 'Asignación'}
                    </p>
                    <span className="text-sm text-gray-500">
                      {new Date(entry.created_at).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">{entry.changed_by}</span> cambió{' '}
                    <span className="text-gray-900">{entry.field_name}</span> de{' '}
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{entry.old_value || 'vacío'}</span>
                    {' a '}
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">{entry.new_value}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
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
