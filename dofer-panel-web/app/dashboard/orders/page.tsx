'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import CreateOrderModal from './CreateOrderModal'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  product_name: string
  product_image?: string
  quantity: number
  status: string
  priority: string
  platform: string
  created_at: string
  updated_at: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ordersPerPage = 50

  useEffect(() => {
    loadOrders()
  }, [filterStatus, currentPage])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const offset = (currentPage - 1) * ordersPerPage
      const params: any = {
        limit: ordersPerPage,
        offset: offset,
      }
      
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      
      const response = await apiClient.get<{ orders: Order[], total: number }>('/orders', { params })
      setOrders(response.orders || [])
      setTotalOrders(response.total || 0)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
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

  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'new', label: 'Nuevas' },
    { value: 'printing', label: 'En Impresión' },
    { value: 'post', label: 'Post-proceso' },
    { value: 'packed', label: 'Empacadas' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ]

  const getFilteredOrders = () => {
    return orders.filter(order => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query)
      )
    })
  }

  const exportToExcel = () => {
    const filteredOrders = getFilteredOrders()
    
    // Crear CSV (compatible con Excel)
    const headers = ['# Orden', 'Cliente', 'Email', 'Producto', 'Cantidad', 'Estado', 'Prioridad', 'Plataforma', 'Fecha']
    const rows = filteredOrders.map(order => [
      order.order_number,
      order.customer_name,
      order.customer_email || '',
      order.product_name,
      order.quantity,
      order.status,
      order.priority,
      order.platform,
      new Date(order.created_at).toLocaleDateString('es-MX')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ordenes_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToPDF = () => {
    const filteredOrders = getFilteredOrders()
    
    const doc = new jsPDF()
    
    // Título
    doc.setFontSize(18)
    doc.text('Reporte de Órdenes - DOFER Panel', 14, 22)
    
    // Fecha
    doc.setFontSize(10)
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 30)
    
    // Tabla
    autoTable(doc, {
      startY: 35,
      head: [['# Orden', 'Cliente', 'Producto', 'Cant.', 'Estado', 'Prioridad', 'Fecha']],
      body: filteredOrders.map(order => [
        order.order_number,
        order.customer_name,
        order.product_name,
        order.quantity,
        order.status,
        order.priority,
        new Date(order.created_at).toLocaleDateString('es-MX')
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    })
    
    doc.save(`ordenes_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Gestión de Órdenes
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              📊 Excel
            </button>
            <button 
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              📄 PDF
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Nueva Orden
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar:
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por # orden, cliente o producto..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por estado:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Cargando órdenes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    # Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cant.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prioridad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plataforma
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
                {getFilteredOrders().length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery
                        ? `No se encontraron órdenes que coincidan con "${searchQuery}"`
                        : filterStatus === 'all' 
                        ? 'No hay órdenes registradas' 
                        : `No hay órdenes con estado "${statusOptions.find(o => o.value === filterStatus)?.label}"`
                      }
                    </td>
                  </tr>
                ) : (
                  getFilteredOrders().map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{order.customer_name}</div>
                        <div className="text-xs text-gray-500">{order.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {order.product_image && (
                            <img 
                              src={order.product_image} 
                              alt={order.product_name}
                              className="h-10 w-10 object-cover rounded border border-gray-200"
                            />
                          )}
                          <span className="text-sm text-gray-900">{order.product_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {order.quantity}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(order.priority)}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {order.platform}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                          Ver detalles →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalOrders > ordersPerPage && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-medium text-gray-900">{(currentPage - 1) * ordersPerPage + 1}</span> a{' '}
              <span className="font-medium text-gray-900">
                {Math.min(currentPage * ordersPerPage, totalOrders)}
              </span>{' '}
              de <span className="font-medium text-gray-900">{totalOrders}</span> órdenes
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {Math.ceil(totalOrders / ordersPerPage)}
                </span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / ordersPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(totalOrders / ordersPerPage)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary for single page */}
      {totalOrders > 0 && totalOrders <= ordersPerPage && (
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">
            Mostrando <span className="font-medium text-gray-900">{orders.length}</span> órdenes
          </p>
        </div>
      )}
      
      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadOrders}
      />
    </div>
  )
}
