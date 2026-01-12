'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Quote, QuoteItem } from '@/types'
import { generateQuotePDF } from '@/lib/pdfGenerator'

export default function QuoteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const quoteId = params.id as string

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadQuote()
  }, [quoteId])

  const loadQuote = async () => {
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
  }

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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📦 Items de la Cotización</h2>
        
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
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-600">{formatCurrency(quote.total)}</span>
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
            <button
              onClick={() => alert('Función de convertir a pedido próximamente')}
              className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700"
            >
              📦 Convertir a Pedido
            </button>
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
    </div>
  )
}
