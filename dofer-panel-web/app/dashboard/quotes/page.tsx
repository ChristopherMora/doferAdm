'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Quote } from '@/types'

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    loadQuotes()
  }, [])

  const loadQuotes = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<{ quotes: Quote[], total: number }>('/quotes')
      setQuotes(response.quotes || [])
    } catch (error) {
      console.error('Error loading quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      expired: 'Expirada',
    }
    return labels[status] || status
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const filteredQuotes = filterStatus === 'all' 
    ? quotes 
    : quotes.filter(q => q.status === filterStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💼 Cotizaciones</h1>
          <p className="text-gray-600">Gestiona cotizaciones de clientes</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/quotes/new')}
          className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700"
        >
          ➕ Nueva Cotización
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Filtrar por estado:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="expired">Expiradas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Cargando cotizaciones...
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay cotizaciones {filterStatus !== 'all' && `con estado "${getStatusLabel(filterStatus)}"`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    # Cotización
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Válida hasta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {quote.quote_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{quote.customer_name}</div>
                      <div className="text-xs text-gray-500">{quote.customer_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(quote.status)}`}>
                        {getStatusLabel(quote.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(quote.valid_until).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(quote.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        Ver detalles →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredQuotes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">
            Mostrando <span className="font-medium text-gray-900">{filteredQuotes.length}</span> cotizaciones
          </p>
        </div>
      )}
    </div>
  )
}
