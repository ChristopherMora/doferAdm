'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, User, Package, GripVertical } from 'lucide-react'
import { Order } from '@/types'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const STATUS_COLUMNS = [
  { id: 'new', label: 'Nuevas', icon: '✨', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'printing', label: 'Imprimiendo', icon: '🖨️', color: 'bg-purple-50 border-purple-200' },
  { id: 'post', label: 'Post-Proceso', icon: '🔧', color: 'bg-blue-50 border-blue-200' },
  { id: 'packed', label: 'Empacadas', icon: '📦', color: 'bg-orange-50 border-orange-200' },
  { id: 'ready', label: 'Listas', icon: '✅', color: 'bg-green-50 border-green-200' },
  { id: 'delivered', label: 'Entregadas', icon: '🚚', color: 'bg-gray-50 border-gray-200' },
]

function OrderCard({ order, isDragging, isDragOverlay }: { order: Order; isDragging?: boolean; isDragOverlay?: boolean }) {
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
    }
    return colors[priority] || colors.normal
  }

  return (
    <Card className={`
      touch-none select-none transition-all duration-200
      ${isDragging && !isDragOverlay ? 'opacity-30 scale-95' : 'hover:shadow-lg'}
      ${isDragOverlay ? 'rotate-3 shadow-2xl scale-105 cursor-grabbing' : 'cursor-grab'}
      bg-white dark:bg-card border-border
    `}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 truncate">
              {order.order_number}
            </span>
          </div>
          {order.priority && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${getPriorityColor(order.priority)}`}>
              {order.priority}
            </span>
          )}
        </div>

        <h4 className="font-semibold text-sm mb-2 line-clamp-2 text-gray-900 dark:text-gray-100">
          {order.product_name}
        </h4>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-medium">{order.customer_name}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
            <span className="capitalize px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              {order.platform}
            </span>
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">×{order.quantity}</span>
          </div>
          {order.assigned_to && (
            <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              👷 {order.assigned_to}
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
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Configurar sensores para mouse y touch
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms de press antes de activar drag
        tolerance: 5,
      },
    })
  )

  useEffect(() => {
    loadOrders()
    const interval = setInterval(loadOrders, 60000)
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const order = orders.find(o => o.id === active.id)
    if (order) {
      setActiveOrder(order)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveOrder(null)

    if (!over) return

    const orderId = active.id as string
    const newStatus = over.id as string
    const order = orders.find(o => o.id === orderId)

    if (!order || order.status === newStatus) return

    setIsUpdating(true)

    // Actualización optimista
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o
    ))

    try {
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus })
    } catch (error) {
      console.error('Error updating order status:', error)
      // Revertir en caso de error
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: order.status } : o
      ))
      alert('❌ Error al actualizar el estado. Intenta de nuevo.')
    } finally {
      setIsUpdating(false)
    }
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
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="bg-card border-b shadow-sm p-3 md:p-4 sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Flujo de Trabajo Kanban</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
                🖱️ Arrastra las tarjetas entre columnas • 📱 Mantén presionado en móvil
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isUpdating && (
                <span className="text-xs sm:text-sm text-muted-foreground animate-pulse">
                  Actualizando...
                </span>
              )}
              <Button 
                onClick={loadOrders} 
                variant="outline" 
                size="sm" 
                disabled={isUpdating}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
                <span className="sm:hidden">Actualizar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-2 sm:p-4">
          <div className="flex gap-2 sm:gap-4 h-full min-w-max pb-4">
            {STATUS_COLUMNS.map((column) => {
              const columnOrders = getOrdersByStatus(column.id)
              
              return (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  orders={columnOrders}
                  activeOrderId={activeOrder?.id}
                />
              )
            })}
          </div>
        </div>

        {/* Mobile hint */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t p-2 text-center text-xs text-muted-foreground">
          💡 Mantén presionada una tarjeta para moverla
        </div>
      </div>

      {/* Drag Overlay - Muestra la tarjeta mientras se arrastra */}
      <DragOverlay>
        {activeOrder ? (
          <OrderCard order={activeOrder} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Componente para columna droppable
function DroppableColumn({ 
  column, 
  orders, 
  activeOrderId 
}: { 
  column: typeof STATUS_COLUMNS[0]
  orders: Order[]
  activeOrderId?: string
}) {
  const { useDroppable } = require('@dnd-kit/core')
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  })

  return (
    <div className="flex-shrink-0 w-72 sm:w-80 flex flex-col h-full">
      {/* Column Header */}
      <div className={`
        p-2 sm:p-3 rounded-t-xl border-2 border-b-0 
        ${column.color} 
        ${isOver ? 'ring-4 ring-primary ring-opacity-50 scale-[1.02]' : ''} 
        transition-all duration-200
      `}>
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl">{column.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-xs uppercase tracking-wide truncate">
              {column.label}
            </h3>
            <p className="text-xs text-muted-foreground">{orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}</p>
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div 
        ref={setNodeRef}
        className={`
          flex-1 p-2 space-y-2 
          min-h-[400px] sm:min-h-[600px] max-h-[calc(100vh-250px)] sm:max-h-[calc(100vh-200px)]
          border-2 border-t-0 rounded-b-xl 
          ${column.color} 
          ${isOver ? 'ring-4 ring-primary ring-opacity-50 bg-primary/5' : ''} 
          overflow-y-auto transition-all duration-200
          scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent
        `}
      >
        {orders.map((order) => (
          <DraggableOrder 
            key={order.id} 
            order={order}
            isDragging={activeOrderId === order.id}
          />
        ))}

        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-3" />
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Sin órdenes</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Arrastra aquí para mover
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para orden draggable
function DraggableOrder({ order, isDragging }: { order: Order; isDragging: boolean }) {
  const { useDraggable } = require('@dnd-kit/core')
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <OrderCard order={order} isDragging={isDragging} />
    </div>
  )
}