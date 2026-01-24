'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { OrderItem, OrderPayment, Order as OrderType } from '@/types'
import ChangeStatusModal from '../ChangeStatusModal'
import AssignOperatorModal from '../AssignOperatorModal'
import OrderTimer from '@/components/OrderTimer'
import OrderLabel from '@/components/OrderLabel'
import { Plus, X, DollarSign, Package, Trash2 } from 'lucide-react'

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
  const [order, setOrder] = useState<OrderType | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  
  // Estado para modales de items
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItem, setNewItem] = useState({
    product_name: '',
    description: '',
    quantity: 1,
    unit_price: 0
  })
  
  // Estado para modal de pago
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)
  const [newPayment, setNewPayment] = useState({
    amount: 0,
    payment_method: 'efectivo',
    notes: ''
  })

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [orderData, historyData, itemsData, paymentsData] = await Promise.all([
        apiClient.get<OrderType>(`/orders/${params.id}`),
        apiClient.get<{ history: HistoryEntry[] }>(`/orders/${params.id}/history`),
        apiClient.get<{ items: OrderItem[] }>(`/orders/${params.id}/items`),
        apiClient.get<{ payments: OrderPayment[] }>(`/orders/${params.id}/payments`).catch(() => ({ payments: [] }))
      ])
      setOrder(orderData)
      setHistory(historyData.history || [])
      setItems(itemsData.items || [])
      setPayments(paymentsData.payments || [])
    } catch (err: any) {
      console.error('Error loading order:', err)
      setError(err.response?.data?.error || err.message || 'Error al cargar la orden')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const handleItemToggle = async (itemId: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/orders/${params.id}/items/${itemId}/status`, {
        is_completed: !currentStatus
      })
      setItems(items.map(item => 
        item.id === itemId 
          ? { ...item, is_completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : undefined }
          : item
      ))
    } catch (err: any) {
      console.error('Error updating item status:', err)
      alert('Error al actualizar el estado del item')
    }
  }

  const handleAddItem = async () => {
    if (!newItem.product_name || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      alert('Por favor completa todos los campos')
      return
    }

    try {
      const item = await apiClient.post<OrderItem>(`/orders/${params.id}/items`, newItem)
      setItems([...items, item])
      setShowAddItemModal(false)
      setNewItem({ product_name: '', description: '', quantity: 1, unit_price: 0 })
      // Recargar la orden para actualizar los totales
      await loadOrder()
    } catch (err: any) {
      console.error('Error adding item:', err)
      alert('Error al agregar el item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este item?')) return

    try {
      await apiClient.delete(`/orders/${params.id}/items/${itemId}`)
      setItems(items.filter(item => item.id !== itemId))
      // Recargar la orden para actualizar los totales
      await loadOrder()
    } catch (err: any) {
      console.error('Error deleting item:', err)
      alert('Error al eliminar el item')
    }
  }

  const handleAddPayment = async () => {
    if (newPayment.amount <= 0) {
      alert('El monto debe ser mayor a 0')
      return
    }

    try {
      const payment = await apiClient.post<OrderPayment>(`/orders/${params.id}/payments`, {
        ...newPayment,
        created_by: 'admin', // TODO: obtener del usuario actual
        payment_date: new Date().toISOString()
      })
      setPayments([payment, ...payments])
      setShowAddPaymentModal(false)
      setNewPayment({ amount: 0, payment_method: 'efectivo', notes: '' })
      // Recargar la orden para actualizar los totales
      await loadOrder()
    } catch (err: any) {
      console.error('Error adding payment:', err)
      alert('Error al agregar el pago')
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pago?')) return

    try {
      await apiClient.delete(`/orders/${params.id}/payments/${paymentId}`)
      setPayments(payments.filter(p => p.id !== paymentId))
      // Recargar la orden para actualizar los totales
      await loadOrder()
    } catch (err: any) {
      console.error('Error deleting payment:', err)
      alert('Error al eliminar el pago')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
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

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.total, 0)
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

        {/* Payment Section - NEW */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Información de Pago
            </h2>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    console.log('Recalculando totales para orden:', params.id)
                    const updatedOrder = await apiClient.post<OrderType>(`/orders/${params.id}/recalculate`)
                    console.log('Orden actualizada recibida:', updatedOrder)
                    setOrder(updatedOrder)
                    const msg = `✅ Totales recalculados:\n\n` +
                      `Monto Total: ${formatCurrency(updatedOrder.amount)}\n` +
                      `Pagado: ${formatCurrency(updatedOrder.amount_paid)}\n` +
                      `Balance: ${formatCurrency(updatedOrder.balance)}`
                    alert(msg)
                  } catch (err: any) {
                    console.error('Error completo al recalcular:', err)
                    alert('❌ Error al recalcular totales:\n' + (err.message || JSON.stringify(err)))
                  }
                }}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                title="Recalcular totales desde items y pagos"
              >
                🔄 Recalcular
              </button>
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                Agregar Pago
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Monto Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(order.amount || 0)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Pagado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(order.amount_paid || 0)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Balance</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(order.balance || 0)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Historial de Pagos</h3>
              {payments.length === 0 ? (
                <p className="text-gray-500 text-sm italic text-center py-4">
                  No hay pagos registrados aún
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => {
                    const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null
                    const isValidDate = paymentDate && !isNaN(paymentDate.getTime())
                    
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {typeof payment.amount === 'number' ? formatCurrency(payment.amount) : '$0.00'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {payment.payment_method && `${payment.payment_method} • `}
                            {isValidDate 
                              ? paymentDate.toLocaleString('es-MX', {
                                  dateStyle: 'short',
                                  timeStyle: 'short'
                                })
                              : 'Fecha no disponible'
                            }
                          </p>
                          {payment.notes && <p className="text-xs text-gray-600 mt-1">{payment.notes}</p>}
                        </div>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Eliminar pago"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order Items - UPDATED */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items del Pedido ({items.filter(i => i.is_completed).length}/{items.length} completados)
            </h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              Agregar Item
            </button>
          </div>
          
          {items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay items agregados</p>
          ) : (
            <>
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
                            Cantidad: {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Eliminar item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(getTotalItems())}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Agregar Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Agregar Nuevo Item</h3>
              <button
                onClick={() => {
                  setShowAddItemModal(false)
                  setNewItem({ product_name: '', description: '', quantity: 1, unit_price: 0 })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={newItem.product_name}
                  onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Tortuga en ola"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Total del Item</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(newItem.quantity * newItem.unit_price)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddItemModal(false)
                    setNewItem({ product_name: '', description: '', quantity: 1, unit_price: 0 })
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddItem}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Agregar Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Pago */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Registrar Pago</h3>
              <button
                onClick={() => {
                  setShowAddPaymentModal(false)
                  setNewPayment({ amount: 0, payment_method: 'efectivo', notes: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Balance Pendiente</p>
                <p className="text-3xl font-bold text-red-600">{formatCurrency(order.balance || 0)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto del Pago *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Detalles del pago..."
                />
              </div>

              {newPayment.amount > 0 && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-700">Nuevo Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency((order.balance || 0) - newPayment.amount)}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddPaymentModal(false)
                    setNewPayment({ amount: 0, payment_method: 'efectivo', notes: '' })
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddPayment}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Registrar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resto de componentes del backup (Timestamps, Actions, History, etc.) */}
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
        <div className="flex gap-3 flex-wrap">
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
          <button
            onClick={() => setShowLabel(!showLabel)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {showLabel ? '📦 Ocultar Etiqueta' : '🏷️ Ver Etiqueta'}
          </button>
          {showLabel && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              🖨️ Imprimir Etiqueta
            </button>
          )}
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

      {/* Label Preview */}
      {showLabel && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📦 Etiqueta de Envío
          </h2>
          <div className="flex justify-center">
            <OrderLabel
              orderNumber={order.order_number}
              customerName={order.customer_name}
              customerPhone={order.customer_phone || ''}
              customerEmail={order.customer_email || ''}
              publicId={order.public_id}
              items={items}
              createdAt={order.created_at}
              platform={order.platform}
            />
          </div>
        </div>
      )}

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
