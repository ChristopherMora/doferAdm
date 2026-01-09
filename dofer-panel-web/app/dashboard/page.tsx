'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

interface OrderStats {
  total_orders: number
  orders_by_status: Record<string, number>
  urgent_orders: number
  today_orders: number
  completed_today: number
  average_per_day: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState<any[]>([])

  useEffect(() => {
    loadDashboardData()
    // Auto-refresh cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      // Get statistics from backend
      const statsData = await apiClient.get<OrderStats>('/orders/stats')
      setStats(statsData)

      // Get recent orders
      const response = await apiClient.get<{ orders: any[], total: number }>('/orders?limit=5')
      setRecentOrders(response.orders || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando dashboard...</div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Órdenes', value: stats.total_orders, color: 'bg-blue-500', icon: '📦' },
    { label: 'Hoy', value: stats.today_orders, color: 'bg-green-500', icon: '📅' },
    { label: 'Urgentes', value: stats.urgent_orders, color: 'bg-red-500', icon: '🔥' },
    { label: 'Completadas Hoy', value: stats.completed_today, color: 'bg-emerald-500', icon: '✅' },
    { label: 'Promedio/Día', value: stats.average_per_day.toFixed(1), color: 'bg-purple-500', icon: '📊' },
  ]

  const statusCards = Object.entries(stats.orders_by_status).map(([status, count]) => {
    const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
      new: { label: 'Nuevas', color: 'bg-yellow-500', icon: '🆕' },
      printing: { label: 'Imprimiendo', color: 'bg-purple-500', icon: '🖨️' },
      post: { label: 'Post-Proceso', color: 'bg-blue-500', icon: '🔧' },
      packed: { label: 'Empacadas', color: 'bg-indigo-500', icon: '📦' },
      ready: { label: 'Listas', color: 'bg-green-500', icon: '✔️' },
      delivered: { label: 'Entregadas', color: 'bg-gray-500', icon: '🚚' },
      cancelled: { label: 'Canceladas', color: 'bg-red-500', icon: '❌' },
    }
    const info = statusLabels[status] || { label: status, color: 'bg-gray-500', icon: '📋' }
    return { ...info, value: count, status }
  })

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

  return (
    <div className="space-y-8">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Órdenes por Estado</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {statusCards.map((card) => (
            <div key={card.status} className="text-center">
              <div className={`${card.color} w-16 h-16 rounded-lg flex items-center justify-center text-3xl mx-auto mb-2`}>
                {card.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-600">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Órdenes Recientes</h3>
            <a
              href="/dashboard/orders"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              Ver todas →
            </a>
          </div>
        </div>
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
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No hay órdenes registradas
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.product_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
