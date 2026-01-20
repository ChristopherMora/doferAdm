'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, User, Package } from 'lucide-react'
import { Order } from '@/types'

const STATUS_COLUMNS = [
  { id: 'new', label: 'Nuevas', icon: '✨', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'printing', label: 'Imprimiendo', icon: '🖨️', color: 'bg-purple-50 border-purple-200' },
  { id: 'post', label: 'Post-Proceso', icon: '🔧', color: 'bg-blue-50 border-blue-200' },
  { id: 'packed', label: 'Empacadas', icon: '📦', color: 'bg-orange-50 border-orange-200' },
  { id: 'ready', label: 'Listas', icon: '✅', color: 'bg-green-50 border-green-200' },
  { id: 'delivered', label: 'Entregadas', icon: '🚚', color: 'bg-gray-50 border-gray-200' },
]

function OrderCard({ order, isDragging }: { order: Order; isDragging?: boolean }) {
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      normal: 'bg-blue-100 text-blue-700 border-blue-300',
      low: 'bg-gray-100 text-gray-700 border-gray-300',
    }
    return colors[priority] || colors.normal
  }

  return (
    <Card className={`touch-none select-none ${isDragging ? 'opacity-50 scale-105 rotate-2' : 'hover:shadow-lg transition-all'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-mono font-semibold text-gray-700">{order.order_number}</span>
          {order.priority && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium border ${getPriorityColor(order.priority)}`}>
              {order.priority}
            </span>
          )}
        </div>

        {order.product_image && (
          <div className="mb-3">
            <img
              src={order.product_image}
              alt={order.product_name}
              className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
            />
          </div>
        )}

        <h4 className="font-semibold text-base mb-3 line-clamp-2 text-gray-900">
          {order.product_name}
        </h4>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="truncate font-medium">{order.customer_name}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span className="capitalize px-2 py-1 bg-gray-100 rounded text-xs font-medium">
              {order.platform}
            </span>
            <span className="font-bold text-base text-gray-900">×{order.quantity}</span>
          </div>
          {order.assigned_to && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-600">👷 {order.assigned_to}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function KanbanPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null)

  useEffect(() => {
    loadOrders()
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

  const handleTouchStart = (e: React.TouchEvent, order: Order) => {
    e.currentTarget.classList.add('dragging')
    setDraggedOrder(order)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const column = element?.closest('[data-column-id]')
    if (column) {
      const columnId = column.getAttribute('data-column-id')
      setDraggedOverColumn(columnId)
    }
  }

  const handleTouchEnd = async (e: React.TouchEvent) => {
    e.currentTarget.classList.remove('dragging')
    
    if (!draggedOrder || !draggedOverColumn) {
      setDraggedOrder(null)
      setDraggedOverColumn(null)
      return
    }

    const newStatus = draggedOverColumn
    if (draggedOrder.status === newStatus) {
      setDraggedOrder(null)
      setDraggedOverColumn(null)
      return
    }

    try {
      await apiClient.patch(`/orders/${draggedOrder.id}/status`, { status: newStatus })
      setOrders(orders.map(o => 
        o.id === draggedOrder.id ? { ...o, status: newStatus as Order['status'] } : o
      ))
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error al actualizar el estado')
    }

    setDraggedOrder(null)
    setDraggedOverColumn(null)
  }

  const handleDragStart = (e: React.DragEvent, order: Order) => {
    setDraggedOrder(order)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedOrder(null)
    setDraggedOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    
    if (!draggedOrder || draggedOrder.status === newStatus) {
      setDraggedOrder(null)
      return
    }

    try {
      await apiClient.patch(`/orders/${draggedOrder.id}/status`, { status: newStatus })
      setOrders(orders.map(o => 
        o.id === draggedOrder.id ? { ...o, status: newStatus as Order['status'] } : o
      ))
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error al actualizar el estado')
    }

    setDraggedOrder(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-lg text-muted-foreground">Cargando tablero...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Flujo de Trabajo</h1>
            <p className="text-sm text-gray-600 mt-1">Arrastra las tarjetas entre columnas para actualizar estado</p>
          </div>
          <Button onClick={loadOrders} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 min-w-max">
          {STATUS_COLUMNS.map((column) => {
            const columnOrders = getOrdersByStatus(column.id)
            const isHovered = draggedOverColumn === column.id
            
            return (
              <div
                key={column.id}
                data-column-id={column.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
                onMouseEnter={() => draggedOrder && setDraggedOverColumn(column.id)}
                className="w-full md:w-80"
              >
                {/* Column Header */}
                <div className={`p-4 rounded-t-xl border-2 border-b-0 ${column.color} ${isHovered ? 'ring-4 ring-blue-300' : ''} transition-all`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{column.icon}</span>
                      <div>
                        <h3 className="font-bold text-sm uppercase tracking-wide text-gray-800">
                          {column.label}
                        </h3>
                        <p className="text-xs text-gray-600 font-medium">{columnOrders.length} órdenes</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cards Container */}
                <div 
                  className={`flex-1 p-3 space-y-3 min-h-[500px] border-2 border-t-0 rounded-b-xl ${column.color} ${isHovered ? 'ring-4 ring-blue-300 bg-blue-50' : ''} overflow-y-auto transition-all`}
                  style={{ maxHeight: 'calc(100vh - 250px)' }}
                >
                  {columnOrders.map((order) => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, order)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <OrderCard 
                        order={order} 
                        isDragging={draggedOrder?.id === order.id}
                      />
                    </div>
                  ))}

                  {columnOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Package className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-500 font-medium">Sin órdenes</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
