'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  Plus, 
  FileText, 
  Package, 
  Calendar, 
  Flame, 
  CheckCircle, 
  Clock, 
  XCircle, 
  BarChart,
  AlertTriangle 
} from 'lucide-react'

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
  const [backendConnected, setBackendConnected] = useState(true)
  const [dueSoonCount, setDueSoonCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [relativeTime, setRelativeTime] = useState('')
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    loadDashboardData()
    // Auto-refresh cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!lastUpdate) {
      setRelativeTime('')
      return
    }

    const updateRelativeTime = () => {
      const diffMs = Date.now() - lastUpdate.getTime()
      if (diffMs < 5000) {
        setRelativeTime('Justo ahora')
        return
      }

      const diffSeconds = Math.floor(diffMs / 1000)
      if (diffSeconds < 60) {
        setRelativeTime(`Hace ${diffSeconds}s`)
        return
      }

      const diffMinutes = Math.floor(diffSeconds / 60)
      if (diffMinutes < 60) {
        setRelativeTime(`Hace ${diffMinutes}m`)
        return
      }

      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) {
        setRelativeTime(`Hace ${diffHours}h`)
        return
      }

      const diffDays = Math.floor(diffHours / 24)
      setRelativeTime(`Hace ${diffDays}d`)
    }

    updateRelativeTime()
    const timer = setInterval(updateRelativeTime, 1000)
    return () => clearInterval(timer)
  }, [lastUpdate])

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true)
      if (!hasLoadedRef.current) {
        setLoading(true)
      }
      // Get statistics from backend
      const statsData = await apiClient.get<OrderStats>('/orders/stats')
      setStats(statsData)

      // Get recent orders
      const response = await apiClient.get<{ orders: any[], total: number }>('/orders?limit=5')
      setRecentOrders(response.orders || [])
      
      // Calculate due soon and overdue
      const allOrdersResponse = await apiClient.get<{ orders: any[] }>('/orders?limit=1000')
      const allOrders = allOrdersResponse.orders || []
      const now = new Date()
      
      let dueSoon = 0
      let overdue = 0
      
      allOrders.forEach((order: any) => {
        if (order.delivery_deadline && order.status !== 'delivered' && order.status !== 'cancelled') {
          const deadline = new Date(order.delivery_deadline)
          const diffTime = deadline.getTime() - now.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          if (diffDays < 0) {
            overdue++
          } else if (diffDays <= 2) {
            dueSoon++
          }
        }
      })
      
      setDueSoonCount(dueSoon)
      setOverdueCount(overdue)
      setBackendConnected(true)
      hasLoadedRef.current = true
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setBackendConnected(false)
      setLastUpdate(null)
      if (!hasLoadedRef.current) {
        // Si el backend no está disponible y nunca se ha cargado, usar datos de ejemplo
        setStats({
          total_orders: 0,
          orders_by_status: {
            'Pendiente': 0,
            'En Producción': 0,
            'Completado': 0
          },
          urgent_orders: 0,
          today_orders: 0,
          completed_today: 0,
          average_per_day: 0
        })
        setRecentOrders([])
      }
      hasLoadedRef.current = true
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando dashboard...</div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Órdenes', value: stats.total_orders, color: 'bg-blue-500', icon: '📦' },
    { label: 'Hoy', value: stats.today_orders, color: 'bg-green-500', icon: '📅' },
    { label: 'Urgentes', value: stats.urgent_orders, color: 'bg-red-500', icon: '🔥' },
    { label: 'Completadas Hoy', value: stats.completed_today, color: 'bg-emerald-500', icon: '✅' },
    { label: 'Vencen Pronto', value: dueSoonCount, color: 'bg-orange-500', icon: '⏰' },
    { label: 'Vencidas', value: overdueCount, color: 'bg-red-600', icon: '❌' },
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
      new: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
      printing: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      post: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
      packed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
      ready: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
      delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
    }
    return badges[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-200'
  }

  return (
    <div className="space-y-8 transition-colors duration-200">
      {/* Header con acciones rápidas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {lastUpdate ? (
                <>
                  Última actualización: {lastUpdate.toLocaleTimeString('es-MX')}
                  <span className="ml-2 inline-flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    {isRefreshing ? 'Actualizando...' : relativeTime || 'Justo ahora'}
                  </span>
                </>
              ) : (
                'Cargando datos...'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadDashboardData}
              disabled={isRefreshing}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isRefreshing 
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95'
              }`}
            >
              {isRefreshing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Actualizando
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  🔄 Actualizar
                </span>
              )}
            </button>
            <button
              onClick={() => window.location.href = '/dashboard/orders/new'}
              className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg font-medium hover:bg-green-700 dark:hover:bg-green-600 active:scale-95 transition-all"
            >
              ➕ Nueva Orden
            </button>
            <button
              onClick={() => window.location.href = '/dashboard/quotes/new'}
              className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-700 dark:hover:bg-purple-600 active:scale-95 transition-all"
            >
              📝 Nueva Cotización
            </button>
          </div>
        </div>
      </div>

      {/* Alerta si no hay conexión con el backend */}
      {!backendConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/40 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Backend no conectado
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-100/80">
                <p>
                  El servidor API no está respondiendo. Mostrando datos de ejemplo.
                </p>
                <p className="mt-1">
                  Para iniciar el backend: <code className="bg-yellow-100 dark:bg-yellow-800/60 px-2 py-1 rounded">cd dofer-panel-api && go run cmd/api/main.go</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.slice(0, 4).map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{card.label}</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
              </div>
              <div className={`${card.color} w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.slice(4).map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{card.label}</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
              </div>
              <div className={`${card.color} w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Órdenes por Estado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {statusCards.map((card) => (
            <div key={card.status} className="text-center hover:scale-105 transition-transform cursor-pointer">
              <div className={`${card.color} w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-3xl md:text-4xl mx-auto mb-3 shadow-lg`}>
                {card.icon}
              </div>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{card.value}</p>
              <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Órdenes Recientes</h3>
            <Link
              href="/dashboard/orders"
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              Ver todas →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  # Orden
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  Producto
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="text-6xl mb-4">📦</div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No hay órdenes registradas</p>
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                    <td className="px-4 md:px-6 py-4 text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200">
                      {order.order_number}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {order.customer_name}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                      {order.product_name}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-2 md:px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
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
