'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface BackendPrinterCurrentJob {
  order_id: string
  assigned_at: string
  estimated_completion?: string
}

interface BackendPrinter {
  id: string
  name: string
  model?: string
  material?: string
  status: 'available' | 'busy' | 'maintenance' | 'offline' | string
  queue_jobs?: number
  current_job?: BackendPrinterCurrentJob
}

interface BackendOrder {
  id: string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  created_at: string
  product_name?: string
}

interface AutoAssignResponse {
  assignment: {
    assignment_id: string
    order_id: string
    printer_id: string
    printer_name: string
    queue_position: number
    estimated_start: string
    estimated_completion: string
  }
}

type PrinterStatus = 'available' | 'busy' | 'maintenance' | 'offline'

interface PrinterFormState {
  name: string
  model: string
  material: string
  status: PrinterStatus
}

const initialPrinterForm: PrinterFormState = {
  name: '',
  model: '',
  material: 'PLA',
  status: 'available',
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState<BackendPrinter[]>([])
  const [pendingOrders, setPendingOrders] = useState<BackendOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<PrinterFormState>(initialPrinterForm)
  const [editingPrinterID, setEditingPrinterID] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PrinterFormState>(initialPrinterForm)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const stats = useMemo(() => {
    const available = printers.filter((p) => p.status === 'available').length
    const busy = printers.filter((p) => p.status === 'busy').length
    return {
      total: printers.length,
      available,
      busy,
      pendingOrders: pendingOrders.length,
    }
  }, [printers, pendingOrders])

  const loadPrinters = useCallback(async () => {
    try {
      const response = await apiClient.get<{ printers: BackendPrinter[] }>('/printers')
      setPrinters(response.printers || [])
    } catch (error: unknown) {
      setApiError(`Error cargando impresoras: ${getErrorMessage(error, 'Error desconocido')}`)
      setPrinters([])
    }
  }, [])

  const loadPendingOrders = useCallback(async () => {
    try {
      const response = await apiClient.get<{ orders: BackendOrder[] }>('/orders', {
        params: { status: 'new' },
      })
      setPendingOrders(response.orders || [])
    } catch (error: unknown) {
      setApiError((prev) => {
        const message = `Error cargando órdenes: ${getErrorMessage(error, 'Error desconocido')}`
        return prev ? `${prev} | ${message}` : message
      })
      setPendingOrders([])
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setApiError(null)

    await Promise.all([loadPrinters(), loadPendingOrders()])

    setLoading(false)
  }, [loadPendingOrders, loadPrinters])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCreatePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.post('/printers', {
        name: createForm.name,
        model: createForm.model,
        material: createForm.material,
        status: createForm.status,
      })

      setCreateForm(initialPrinterForm)
      setShowCreateForm(false)
      await loadPrinters()
    } catch (error: unknown) {
      setApiError(`Error creando impresora: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (printer: BackendPrinter) => {
    setEditingPrinterID(printer.id)
    setEditForm({
      name: printer.name,
      model: printer.model || '',
      material: printer.material || 'PLA',
      status: normalizeStatus(printer.status),
    })
  }

  const cancelEdit = () => {
    setEditingPrinterID(null)
    setEditForm(initialPrinterForm)
  }

  const handleSaveEdit = async (printerID: string) => {
    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.put(`/printers/${printerID}`, {
        name: editForm.name,
        model: editForm.model,
        material: editForm.material,
        status: editForm.status,
      })
      setEditingPrinterID(null)
      await loadPrinters()
    } catch (error: unknown) {
      setApiError(`Error actualizando impresora: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePrinter = async (printerID: string) => {
    if (!confirm('¿Eliminar esta impresora?')) return

    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.delete(`/printers/${printerID}`)
      await loadPrinters()
    } catch (error: unknown) {
      setApiError(`Error eliminando impresora: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (printerID: string, status: PrinterStatus) => {
    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.patch(`/printers/${printerID}/status`, { status })
      await loadPrinters()
    } catch (error: unknown) {
      setApiError(`Error cambiando estado: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoAssign = async (order: BackendOrder) => {
    setSubmitting(true)
    setApiError(null)
    setSelectedOrder(order.id)
    setAssignmentMessage(null)

    try {
      const response = await apiClient.post<AutoAssignResponse>('/printers/auto-assign', {
        order_id: order.id,
        material: inferOrderMaterial(order),
        estimated_time_hours: 4,
      })

      const assignment = response.assignment
      setAssignmentMessage(
        `Impresora: ${assignment.printer_name} | Inicio: ${new Date(assignment.estimated_start).toLocaleString()} | Fin: ${new Date(assignment.estimated_completion).toLocaleString()}`,
      )

      await loadData()
    } catch (error: unknown) {
      setAssignmentMessage(null)
      setApiError(`Error auto-asignando orden: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompleteAssignment = async (orderID: string) => {
    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.post('/printers/complete-assignment', { order_id: orderID })
      await loadPrinters()
    } catch (error: unknown) {
      setApiError(`Error completando asignación: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando impresoras..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impresoras y Auto-Asignacion"
        badge="Produccion"
        description="CRUD de impresoras, cola activa y auto-asignacion persistente en backend."
        actions={
          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="px-4 py-2 bg-white/15 text-white rounded-xl hover:bg-white/25"
          >
            {showCreateForm ? 'Cancelar' : '+ Nueva Impresora'}
          </button>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">
          {apiError}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreatePrinter} className="panel-surface rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre"
            className="px-3 py-2 border rounded-xl bg-background"
            required
          />
          <input
            type="text"
            value={createForm.model}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Modelo"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <input
            type="text"
            value={createForm.material}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, material: e.target.value }))}
            placeholder="Materiales (PLA,PETG)"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <select
            value={createForm.status}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as PrinterStatus }))}
            className="px-3 py-2 border rounded-xl bg-background"
          >
            <option value="available">Disponible</option>
            <option value="busy">Ocupada</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="offline">Desconectada</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60"
          >
            Guardar
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Impresoras" value={stats.total} />
        <StatCard label="Disponibles" value={stats.available} valueClass="text-green-600" />
        <StatCard label="Ocupadas" value={stats.busy} valueClass="text-yellow-600" />
        <StatCard label="Órdenes Pendientes" value={stats.pendingOrders} valueClass="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard>
          <h2 className="text-xl font-bold mb-4">Impresoras</h2>
          <div className="space-y-3">
            {printers.map((printer) => {
              const isEditing = editingPrinterID === printer.id

              return (
                <div key={printer.id} className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="px-3 py-2 border rounded-xl bg-background"
                      />
                      <input
                        type="text"
                        value={editForm.model}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, model: e.target.value }))}
                        className="px-3 py-2 border rounded-xl bg-background"
                      />
                      <input
                        type="text"
                        value={editForm.material}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, material: e.target.value }))}
                        className="px-3 py-2 border rounded-xl bg-background"
                      />
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as PrinterStatus }))}
                        className="px-3 py-2 border rounded-xl bg-background"
                      >
                        <option value="available">Disponible</option>
                        <option value="busy">Ocupada</option>
                        <option value="maintenance">Mantenimiento</option>
                        <option value="offline">Desconectada</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(printer.id)}
                          className="px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                          disabled={submitting}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-2 border rounded-xl hover:bg-accent"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{printer.name}</h3>
                          <p className="text-sm text-muted-foreground">Modelo: {printer.model || 'Sin modelo'}</p>
                          <p className="text-sm text-muted-foreground">Materiales: {printer.material || 'Sin definir'}</p>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-2 text-sm ${statusTextClass(printer.status)}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass(printer.status)}`} />
                            {statusLabel(printer.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">En cola: {printer.queue_jobs || 0}</p>
                        </div>
                      </div>

                      {printer.current_job && (
                        <div className="p-3 bg-muted/40 border rounded-xl text-sm space-y-1">
                          <p>
                            Trabajo actual: <strong>#{printer.current_job.order_id.slice(0, 8)}</strong>
                          </p>
                          <p>Inicio: {new Date(printer.current_job.assigned_at).toLocaleString()}</p>
                          {printer.current_job.estimated_completion && (
                            <p>Fin estimado: {new Date(printer.current_job.estimated_completion).toLocaleString()}</p>
                          )}
                          <button
                            onClick={() => handleCompleteAssignment(printer.current_job!.order_id)}
                            className="mt-2 px-3 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20"
                            disabled={submitting}
                          >
                            Marcar trabajo como completado
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEdit(printer)}
                          className="px-3 py-1 text-sm border rounded hover:bg-accent"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleStatusChange(printer.id, 'available')}
                          className="px-3 py-1 text-sm border rounded hover:bg-accent"
                        >
                          Disponible
                        </button>
                        <button
                          onClick={() => handleStatusChange(printer.id, 'maintenance')}
                          className="px-3 py-1 text-sm border rounded hover:bg-accent"
                        >
                          Mantenimiento
                        </button>
                        <button
                          onClick={() => handleStatusChange(printer.id, 'offline')}
                          className="px-3 py-1 text-sm border rounded hover:bg-accent"
                        >
                          Offline
                        </button>
                        <button
                          onClick={() => handleDeletePrinter(printer.id)}
                          className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {printers.length === 0 && (
              <EmptyState title="No hay impresoras registradas" description="Agrega una impresora para iniciar la asignacion." />
            )}
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-xl font-bold mb-4">Órdenes Pendientes</h2>
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">Orden #{order.id.slice(0, 8)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {order.product_name || 'Producto'} - Prioridad: {toPriority(order.priority)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAutoAssign(order)}
                    className="px-3 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 text-sm font-medium"
                    disabled={submitting}
                  >
                    Auto-Asignar
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">Creada: {new Date(order.created_at).toLocaleString()}</p>

                {selectedOrder === order.id && assignmentMessage && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                    <div className="font-medium mb-1">Asignada exitosamente</div>
                    <div>{assignmentMessage}</div>
                  </div>
                )}
              </div>
            ))}

            {pendingOrders.length === 0 && (
              <EmptyState
                title="No hay ordenes pendientes por asignar"
                description="Cuando exista una orden nueva aparecera aqui."
              />
            )}
          </div>
        </PanelCard>
      </div>
    </div>
  )
}

function toPriority(value: string): string {
  if (value === 'low') return 'baja'
  if (value === 'high') return 'alta'
  if (value === 'urgent') return 'urgente'
  return 'normal'
}

function inferOrderMaterial(order: BackendOrder): string {
  const product = (order.product_name || '').toUpperCase()
  if (product.includes('RESIN') || product.includes('RESINA')) return 'RESIN'
  if (product.includes('ABS')) return 'ABS'
  if (product.includes('PETG')) return 'PETG'
  if (product.includes('TPU')) return 'TPU'
  return 'PLA'
}

function normalizeStatus(status: string): PrinterStatus {
  if (status === 'available' || status === 'busy' || status === 'maintenance' || status === 'offline') {
    return status
  }
  return 'offline'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Disponible'
    case 'busy':
      return 'Ocupada'
    case 'maintenance':
      return 'Mantenimiento'
    case 'offline':
      return 'Offline'
    default:
      return status
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case 'available':
      return 'bg-green-500'
    case 'busy':
      return 'bg-yellow-500'
    case 'maintenance':
      return 'bg-orange-500'
    case 'offline':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

function statusTextClass(status: string): string {
  switch (status) {
    case 'available':
      return 'text-green-700'
    case 'busy':
      return 'text-yellow-700'
    case 'maintenance':
      return 'text-orange-700'
    case 'offline':
      return 'text-red-700'
    default:
      return 'text-gray-700'
  }
}

function StatCard({ label, value, valueClass }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="panel-surface rounded-xl p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${valueClass || ''}`}>{value}</div>
    </div>
  )
}
