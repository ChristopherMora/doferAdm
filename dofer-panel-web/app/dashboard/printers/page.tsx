'use client'

import { useState, useEffect } from 'react'
import { autoAssignOrder, type Printer, type Order, type AssignmentResult } from '@/lib/autoAssignment'
import { apiClient } from '@/lib/api'

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPrinter, setShowAddPrinter] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [printersData, ordersData] = await Promise.all([
        apiClient.get('/printers'),
        apiClient.get('/orders?status=pending')
      ])
      setPrinters(printersData.printers || [])
      setPendingOrders(ordersData.orders || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoAssign = async (orderId: string) => {
    const order = pendingOrders.find(o => o.id === orderId)
    if (!order) return

    const result = await autoAssignOrder(order, printers)
    setAssignmentResult(result)
    setSelectedOrder(orderId)

    if (result.success) {
      // Asignar en el backend
      try {
        await apiClient.patch(`/orders/${orderId}`, {
          printer_id: result.printerId,
          estimated_start: result.estimatedStart,
          estimated_completion: result.estimatedCompletion
        })
        await loadData()
      } catch (error) {
        console.error('Error assigning order:', error)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500'
      case 'busy': return 'bg-yellow-500'
      case 'maintenance': return 'bg-orange-500'
      case 'offline': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponible'
      case 'busy': return 'Ocupada'
      case 'maintenance': return 'Mantenimiento'
      case 'offline': return 'Desconectada'
      default: return status
    }
  }

  if (loading) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Impresoras y Auto-Asignación</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus impresoras y asigna órdenes automáticamente
          </p>
        </div>
        <button
          onClick={() => setShowAddPrinter(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          + Agregar Impresora
        </button>
      </div>

      {/* Resumen de capacidad */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Impresoras</div>
          <div className="text-2xl font-bold">{printers.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Disponibles</div>
          <div className="text-2xl font-bold text-green-600">
            {printers.filter(p => p.status === 'available').length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Ocupadas</div>
          <div className="text-2xl font-bold text-yellow-600">
            {printers.filter(p => p.status === 'busy').length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Órdenes Pendientes</div>
          <div className="text-2xl font-bold text-blue-600">{pendingOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de impresoras */}
        <div>
          <h2 className="text-xl font-bold mb-4">Impresoras</h2>
          <div className="space-y-3">
            {printers.map((printer) => (
              <div key={printer.id} className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{printer.name}</h3>
                    <div className="text-sm text-muted-foreground">{printer.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(printer.status)}`} />
                    <span className="text-sm">{getStatusText(printer.status)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Volumen:</span>
                    <div className="font-medium">
                      {printer.buildVolume.width} × {printer.buildVolume.height} × {printer.buildVolume.depth} mm
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Materiales:</span>
                    <div className="font-medium">{printer.materials.join(', ')}</div>
                  </div>
                </div>

                {printer.currentJob && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    <div className="text-muted-foreground">Trabajo actual:</div>
                    <div className="font-medium">Orden #{printer.currentJob.orderId.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      Completa: {new Date(printer.currentJob.estimatedCompletion).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {printers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay impresoras registradas
              </div>
            )}
          </div>
        </div>

        {/* Órdenes pendientes */}
        <div>
          <h2 className="text-xl font-bold mb-4">Órdenes Pendientes</h2>
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <div key={order.id} className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold">Orden #{order.id.slice(0, 8)}</h3>
                    <div className="text-sm text-muted-foreground">
                      {order.material} - Prioridad: {order.priority}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAutoAssign(order.id)}
                    className="px-3 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 text-sm font-medium"
                  >
                    Auto-Asignar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Dimensiones:</span>
                    <div className="font-medium">
                      {order.dimensions.width} × {order.dimensions.height} × {order.dimensions.depth} mm
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tiempo estimado:</span>
                    <div className="font-medium">{order.estimatedTime}h</div>
                  </div>
                </div>

                {order.deadline && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Deadline:</span>
                    <span className="font-medium ml-2">
                      {new Date(order.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {selectedOrder === order.id && assignmentResult && (
                  <div className={`mt-3 p-3 rounded-lg ${assignmentResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                    {assignmentResult.success ? (
                      <div className="text-sm">
                        <div className="font-medium text-green-700 mb-1">✓ Asignado exitosamente</div>
                        <div className="text-green-600">
                          Impresora: {assignmentResult.printerName}
                        </div>
                        <div className="text-green-600 text-xs mt-1">
                          Inicio: {assignmentResult.estimatedStart?.toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-red-700">
                        <div className="font-medium mb-1">✗ No se pudo asignar</div>
                        <div>{assignmentResult.reason}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {pendingOrders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay órdenes pendientes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
