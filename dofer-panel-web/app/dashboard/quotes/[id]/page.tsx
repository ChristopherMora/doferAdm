'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Quote, QuoteItem } from '@/types'
import { generateQuotePDF } from '@/lib/pdfGenerator'

interface ConvertToOrderResponse {
  order: {
    id: string
    order_number: string
  }
}

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const quoteId = params.id as string

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingDeleteItemID, setPendingDeleteItemID] = useState<string | null>(null)
  const [confirmDeleteQuoteOpen, setConfirmDeleteQuoteOpen] = useState(false)
  const [confirmConvertOpen, setConfirmConvertOpen] = useState(false)
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false)

  const loadQuote = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<{ quote: Quote; items: QuoteItem[] | null }>(`/quotes/${quoteId}`)
      setQuote({ ...response.quote, items: response.items || [] })
    } catch (error) {
      console.error('Error loading quote:', error)
      alert('Error al cargar cotización')
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  const updateStatus = async (newStatus: 'pending' | 'approved' | 'rejected' | 'expired') => {
    try {
      setUpdating(true)
      await apiClient.patch(`/quotes/${quoteId}/status`, { status: newStatus })
      await loadQuote()
      alert('✅ Estado actualizado')
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error al actualizar estado')
    } finally {
      setUpdating(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      pending: '⏳ Pendiente',
      approved: '✅ Aprobada',
      rejected: '❌ Rechazada',
      expired: '⌛ Expirada',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const handleGeneratePDF = () => {
    if (!quote) return
    generateQuotePDF(quote)
  }

  const deleteQuoteItem = async (itemId: string) => {
    setPendingDeleteItemID(itemId)
  }

  const confirmDeleteQuoteItem = async () => {
    if (!pendingDeleteItemID) return
    
    try {
      await apiClient.delete(`/quotes/${quoteId}/items/${pendingDeleteItemID}`)
      alert('✅ Item eliminado')
      await loadQuote()
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Error al eliminar item')
    } finally {
      setPendingDeleteItemID(null)
    }
  }

  const deleteQuote = async () => {
    setConfirmDeleteQuoteOpen(true)
  }

  const confirmDeleteQuote = async () => {
    try {
      await apiClient.delete(`/quotes/${quoteId}`)
      alert('✅ Cotización eliminada')
      router.push('/dashboard/quotes')
    } catch (error) {
      console.error('Error deleting quote:', error)
      alert('Error al eliminar cotización')
    } finally {
      setConfirmDeleteQuoteOpen(false)
    }
  }

  const convertToOrder = async () => {
    setConfirmConvertOpen(true)
  }

  const confirmConvertToOrder = async () => {
    try {
      setUpdating(true)
      const response = await apiClient.post<ConvertToOrderResponse>(`/quotes/${quoteId}/convert-to-order`, {})
      alert(`✅ Cotización convertida a pedido: ${response.order.order_number}`)
      router.push(`/dashboard/orders`)
    } catch (error: unknown) {
      console.error('Error converting to order:', error)
      const message = getErrorMessage(error, 'Error desconocido')
      if (message.includes('debe estar aprobada')) {
        alert('❌ La cotización debe estar aprobada para convertirla en pedido')
      } else {
        alert(`Error al convertir cotización: ${message}`)
      }
    } finally {
      setUpdating(false)
      setConfirmConvertOpen(false)
    }
  }

  const syncItemsToOrder = async () => {
    setConfirmSyncOpen(true)
  }

  const confirmSyncItemsToOrder = async () => {
    try {
      setUpdating(true)
      await apiClient.post(`/quotes/${quoteId}/sync-items`, {})
      alert('✅ Items sincronizados al pedido exitosamente')
      loadQuote()
    } catch (error: unknown) {
      console.error('Error syncing items:', error)
      alert(`Error: ${getErrorMessage(error, 'No se pudieron sincronizar los items')}`)
    } finally {
      setUpdating(false)
      setConfirmSyncOpen(false)
    }
  }

  const addPayment = async () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      alert('Ingresa un monto válido')
      return
    }

    try {
      setUpdating(true)
      await apiClient.post(`/quotes/${quoteId}/payments`, { amount })
      alert('✅ Pago registrado')
      setPaymentAmount('')
      setShowPaymentModal(false)
      await loadQuote()
    } catch (error: unknown) {
      console.error('Error adding payment:', error)
      alert(`Error al registrar pago: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Cargando cotización...</div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cotización no encontrada</p>
        <button
          onClick={() => router.push('/dashboard/quotes')}
          className="mt-4 text-indigo-600 hover:text-indigo-700"
        >
          ← Volver a cotizaciones
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Cotización {quote.quote_number}</h1>
            {getStatusBadge(quote.status)}
          </div>
          <p className="text-gray-600 mt-1">
            Creada el {formatDate(quote.created_at)}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/quotes')}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Volver
        </button>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">👤 Información del Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="font-medium text-gray-900">{quote.customer_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium text-gray-900">{quote.customer_email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Teléfono</p>
            <p className="font-medium text-gray-900">{quote.customer_phone || 'N/A'}</p>
          </div>
        </div>
        {quote.notes && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">Notas</p>
            <p className="text-gray-900 mt-1">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📦 Items de la Cotización</h2>
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{quote.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</span> piezas totales
          </div>
        </div>
        
        {quote.items && quote.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Especificaciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Unit.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quote.items.map((item: QuoteItem, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="space-y-1">
                        <p>⚖️ {item.weight_grams}g</p>
                        <p>⏱️ {item.print_time_hours}h</p>
                        {item.other_costs > 0 && <p>💰 +{formatCurrency(item.other_costs)}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => deleteQuoteItem(item.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        🗑️ Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cost Breakdown */}
            <div className="mt-6 border-t pt-6">
              <div className="max-w-md ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA (16%):</span>
                  <span className="font-medium">{formatCurrency(quote.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 pb-2">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(quote.total)}</span>
                </div>
                
                {/* Payment Info */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pagado:</span>
                    <span className="font-medium text-blue-600">{formatCurrency(quote.amount_paid || 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className={quote.balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {quote.balance > 0 ? 'Saldo pendiente:' : 'Pagado completo ✓'}
                    </span>
                    <span className={quote.balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {formatCurrency(quote.balance || 0)}
                    </span>
                  </div>
                  
                  {quote.balance > 0 && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full mt-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      💵 Registrar Pago
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay items en esta cotización
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Acciones</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quote.status === 'pending' && (
            <>
              <button
                onClick={() => router.push(`/dashboard/quotes/new?edit=${quote.id}`)}
                className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700"
              >
                ✏️ Editar Cotización
              </button>
              <button
                onClick={() => updateStatus('approved')}
                disabled={updating}
                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                ✅ Aprobar
              </button>
              <button
                onClick={() => updateStatus('rejected')}
                disabled={updating}
                className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                ❌ Rechazar
              </button>
            </>
          )}

          {quote.status === 'approved' && (
            <>
              <button
                onClick={convertToOrder}
                disabled={updating}
                className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                📦 Convertir a Pedido
              </button>
              {quote.converted_to_order_id && (
                <button
                  onClick={syncItemsToOrder}
                  disabled={updating}
                  className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  🔄 Sincronizar Items al Pedido
                </button>
              )}
            </>
          )}

          <button
            onClick={handleGeneratePDF}
            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700"
          >
            📄 Descargar PDF
          </button>

          <button
            onClick={() => window.print()}
            className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700"
          >
            🖨️ Imprimir
          </button>

          <button
            onClick={deleteQuote}
            className="bg-black text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-800"
          >
            🗑️ Eliminar Cotización
          </button>

          <button
            onClick={() => {
              const subject = `Cotización ${quote.quote_number}`
              const body = `Hola ${quote.customer_name},\n\nAdjunto encontrarás la cotización ${quote.quote_number} por un total de ${formatCurrency(quote.total)}.\n\nSaludos!`
              window.location.href = `mailto:${quote.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            }}
            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            📧 Enviar Email
          </button>
        </div>

        {/* Valid Until Info */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            ⏰ Cotización válida hasta: <span className="font-semibold text-gray-900">
              {formatDate(quote.valid_until)}
            </span>
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">💵 Registrar Pago</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Saldo pendiente:</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(quote.balance)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto a pagar:
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={quote.balance}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={addPayment}
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {updating ? 'Procesando...' : 'Registrar'}
                </button>
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPaymentAmount('')
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteItemID !== null}
        title="Eliminar item de cotizacion"
        description="Esta accion eliminara el item seleccionado."
        confirmLabel="Eliminar"
        destructive
        loading={updating}
        onCancel={() => setPendingDeleteItemID(null)}
        onConfirm={confirmDeleteQuoteItem}
      />

      <ConfirmDialog
        open={confirmDeleteQuoteOpen}
        title="Eliminar cotizacion"
        description="Esta accion no se puede deshacer."
        confirmLabel="Eliminar cotizacion"
        destructive
        loading={updating}
        onCancel={() => setConfirmDeleteQuoteOpen(false)}
        onConfirm={confirmDeleteQuote}
      />

      <ConfirmDialog
        open={confirmConvertOpen}
        title="Convertir a pedido"
        description="Se creara una nueva orden a partir de esta cotizacion."
        confirmLabel="Convertir"
        loading={updating}
        onCancel={() => setConfirmConvertOpen(false)}
        onConfirm={confirmConvertToOrder}
      />

      <ConfirmDialog
        open={confirmSyncOpen}
        title="Sincronizar items al pedido"
        description="Esto copiara los items actuales al pedido vinculado."
        confirmLabel="Sincronizar"
        loading={updating}
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={confirmSyncItemsToOrder}
      />
    </div>
  )
}
