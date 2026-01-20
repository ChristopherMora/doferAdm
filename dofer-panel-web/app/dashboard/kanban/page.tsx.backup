'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, GripVertical, User, Package } from 'lucide-react'
import { Order } from '@/types'

const STATUS_COLUMNS = [
  { id: 'new', label: 'Nuevas', icon: '✨' },
  { id: 'printing', label: 'Imprimiendo', icon: '🖨️' },
  { id: 'post', label: 'Post-Proceso', icon: '🔧' },
  { id: 'packed', label: 'Empacadas', icon: '📦' },
  { id: 'ready', label: 'Listas', icon: '✅' },
  { id: 'delivered', label: 'Entregadas', icon: '🚚' },
]

export default function KanbanPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

  const moveOrder = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order || order.status === newStatus) return

    try {
      // Actualizar en el backend
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus })
      
      // Actualizar localmente
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o
      ))
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error al actualizar el estado de la orden')
    }
  }

  const getNextStatus = (currentStatus: string): string | null => {
    const index = STATUS_COLUMNS.findIndex(col => col.id === currentStatus)
    if (index < STATUS_COLUMNS.length - 1) {
      return STATUS_COLUMNS[index + 1].id
    }
    return null
  }

  const getPrevStatus = (currentStatus: string): string | null => {
    const index = STATUS_COLUMNS.findIndex(col => col.id === currentStatus)
    if (index > 0) {
      return STATUS_COLUMNS[index - 1].id
    }
    return null
  }

  const getPriorityBadge = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      urgent: 'destructive',
      high: 'destructive',
      normal: 'default',
      low: 'secondary',
    }
    return variants[priority] || 'secondary'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="text-sm text-muted-foreground mt-3 ml-3">Cargando tablero...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header operativo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flujo de Trabajo</h1>
          <p className="text-sm text-muted-foreground mt-1">Arrastra las tarjetas entre columnas para actualizar estado</p>
        </div>
        <Button onClick={loadOrders} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Kanban Board - enfocado en flujo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATUS_COLUMNS.map((column) => {
          const columnOrders = getOrdersByStatus(column.id)
          return (
            <div
              key={column.id}
              className="flex flex-col"
            >
              {/* Column Header - minimalista */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{column.icon}</span>
                  <h3 className="text-sm font-medium uppercase tracking-wider">{column.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{columnOrders.length} órdenes</p>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 min-h-[400px] p-3 rounded-lg border border-dashed">
                {columnOrders.map((order) => {
                  const nextStatus = getNextStatus(order.status)
                  const prevStatus = getPrevStatus(order.status)
                  
                  return (
                    <Card
                      key={order.id}
                      className="hover:border-primary transition-colors"
                    >
                      <CardContent className="p-3">
                        {/* Order Number */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-muted-foreground">{order.order_number}</span>
                          {order.priority && (
                            <Badge variant={getPriorityBadge(order.priority)} className="text-xs">
                              {order.priority}
                            </Badge>
                          )}
                        </div>

                        {/* Product Image - solo si existe */}
                        {order.product_image && (
                          <div className="mb-2">
                            <img
                              src={order.product_image}
                              alt={order.product_name}
                              className="w-full h-20 object-cover rounded border"
                            />
                          </div>
                        )}

                        {/* Product Name */}
                        <h4 className="font-medium text-sm mb-2 line-clamp-2">
                          {order.product_name}
                        </h4>

                        {/* Info operativa */}
                        <div className="space-y-1 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate">{order.customer_name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{order.platform}</span>
                            <span className="font-medium">×{order.quantity}</span>
                          </div>
                          {order.assigned_to && (
                            <div className="pt-1 border-t">
                              <span>👷 {order.assigned_to}</span>
                            </div>
                          )}
                        </div>

                        {/* Movement Buttons */}
                        <div className="flex gap-1 border-t pt-2">
                          {prevStatus && (
                            <button
                              onClick={() => moveOrder(order.id, prevStatus)}
                              className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                              title={`Mover a ${STATUS_COLUMNS.find(c => c.id === prevStatus)?.label}`}
                            >
                              ← {STATUS_COLUMNS.find(c => c.id === prevStatus)?.icon}
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              onClick={() => moveOrder(order.id, nextStatus)}
                              className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors font-medium"
                              title={`Mover a ${STATUS_COLUMNS.find(c => c.id === nextStatus)?.label}`}
                            >
                              {STATUS_COLUMNS.find(c => c.id === nextStatus)?.icon} →
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {columnOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Sin órdenes</p>
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
