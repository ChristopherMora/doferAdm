'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Order } from '@/types'

const STATUS_COLUMNS = [
  { id: 'new', label: 'Nuevas', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'printing', label: 'Imprimiendo', color: 'bg-purple-100 border-purple-300' },
  { id: 'post', label: 'Post-Proceso', color: 'bg-blue-100 border-blue-300' },
  { id: 'packed', label: 'Empacadas', color: 'bg-indigo-100 border-indigo-300' },
  { id: 'ready', label: 'Listas', color: 'bg-green-100 border-green-300' },
  { id: 'delivered', label: 'Entregadas', color: 'bg-gray-100 border-gray-300' },
]

export default function KanbanPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    loadOrders()
    // Auto-refresh cada 30 segundos
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadOrders = async () => {
    try {
      const response = await apiClient.get<{ orders: Order[], total: number }>('/orders')
      setOrders(response.orders || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status)
  }

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDragging(orderId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', orderId)
  }

  const handleDragEnd = () => {
    setDragging(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const orderId = e.dataTransfer.getData('text/html')
    
    if (!orderId || dragging !== orderId) return

    const order = orders.find(o => o.id === orderId)
    if (!order || order.status === newStatus) return

    try {
      // Actualizar en el backend
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus })
      
      // Actualizar localmente
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ))
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error al actualizar el estado de la orden')
    }
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      low: 'bg-gray-500 text-white',
    }
    return badges[priority] || 'bg-gray-500 text-white'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando tablero Kanban...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tablero Kanban</h1>
          <p className="text-gray-600">Arrastra las tarjetas para cambiar el estado</p>
        </div>
        <button
          onClick={loadOrders}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {STATUS_COLUMNS.map((column) => {
          const columnOrders = getOrdersByStatus(column.id)
          return (
            <div
              key={column.id}
              className={`${column.color} rounded-lg border-2 p-4 min-h-[500px]`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">{column.label}</h3>
                <span className="text-sm text-gray-600">({columnOrders.length})</span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {columnOrders.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg shadow p-4 cursor-move hover:shadow-lg transition-shadow ${
                      dragging === order.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Order Number */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-500">
                        {order.order_number}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getPriorityBadge(order.priority)}`}>
                        {order.priority}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {order.product_name}
                    </h4>

                    {/* Customer */}
                    <p className="text-sm text-gray-600 mb-2">
                      👤 {order.customer_name}
                    </p>

                    {/* Platform & Quantity */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>📱 {order.platform}</span>
                      <span>×{order.quantity}</span>
                    </div>

                    {/* Operator */}
                    {order.assigned_to && (
                      <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                        👷 {order.assigned_to}
                      </div>
                    )}

                    {/* Image Preview */}
                    {order.product_image && (
                      <div className="mt-2">
                        <img
                          src={order.product_image}
                          alt={order.product_name}
                          className="w-full h-24 object-cover rounded"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {columnOrders.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No hay órdenes
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
