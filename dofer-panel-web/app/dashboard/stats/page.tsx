'use client'

import { useEffect, useState } from 'react'
import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, Clock, Target, Package, DollarSign, 
  CheckCircle2, AlertCircle, BarChart3, Calendar
} from 'lucide-react'

interface OrderStats {
  total_orders: number
  orders_by_status: Record<string, number>
  urgent_orders: number
  today_orders: number
  completed_today: number
  average_per_day: number
}

interface Order {
  id: string
  order_number: string
  status: string
  total_price: number
  created_at: string
  platform: string
}

export default function StatsPage() {
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const [statsResponse, ordersResponse] = await Promise.all([
        apiClient.get<OrderStats>('/orders/stats'),
        apiClient.get<{ orders: Order[]; total: number }>('/orders', { params: { limit: 100 } })
      ])
      
      setStats(statsResponse)
      setRecentOrders(ordersResponse.orders || [])
    } catch (err: unknown) {
      console.error('Error fetching stats:', err)
      setError(getErrorMessage(err, 'Error al cargar estadísticas'))
    } finally {
      setLoading(false)
    }
  }

  const calculateRevenue = () => {
    const completedOrders = recentOrders.filter(o => 
      o.status === 'delivered' || o.status === 'ready'
    )
    return completedOrders.reduce((sum, order) => sum + (order.total_price || 0), 0)
  }

  const calculatePendingRevenue = () => {
    const pendingOrders = recentOrders.filter(o => 
      o.status !== 'delivered' && o.status !== 'cancelled'
    )
    return pendingOrders.reduce((sum, order) => sum + (order.total_price || 0), 0)
  }

  const getOrdersByWeek = () => {
    const weeks: Record<string, number> = {}
    recentOrders.forEach(order => {
      const date = new Date(order.created_at)
      const weekKey = `Semana ${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('es-MX', { month: 'short' })}`
      weeks[weekKey] = (weeks[weekKey] || 0) + 1
    })
    return Object.entries(weeks).slice(-4)
  }

  const getPlatformStats = () => {
    const platforms: Record<string, number> = {}
    recentOrders.forEach(order => {
      platforms[order.platform] = (platforms[order.platform] || 0) + 1
    })
    return Object.entries(platforms).sort((a, b) => b[1] - a[1])
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
      case 'delivered':
      case 'ready':
        return 'default'
      case 'printing':
      case 'processing':
        return 'secondary'
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      printing: 'Imprimiendo',
      post_processing: 'Post-Proceso',
      packing: 'Empacando',
      ready: 'Listo',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    }
    return labels[status] || status
  }

  if (loading) {
    return <LoadingState label="Cargando estadisticas..." />
  }

  if (error) {
    return (
      <PanelCard className="border-destructive">
        <CardContent className="py-2 px-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </PanelCard>
    )
  }

  if (!stats) {
    return (
      <EmptyState title="No hay estadisticas disponibles" description="Aun no hay datos para mostrar." />
    )
  }

  const revenue = calculateRevenue()
  const pendingRevenue = calculatePendingRevenue()
  const weeklyOrders = getOrdersByWeek()
  const platformStats = getPlatformStats()
  const completionRate = stats.total_orders > 0 
    ? ((stats.orders_by_status?.delivered || 0) / stats.total_orders * 100).toFixed(1)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadisticas del Negocio"
        badge="Analitica"
        description="Analisis general de ordenes, ingresos y rendimiento operativo."
        actions={
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-white/15 text-white rounded-xl hover:bg-white/25"
          >
            Actualizar
          </button>
        }
      />

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_orders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.today_orders} hoy
            </p>
          </CardContent>
        </Card>

        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Realizados</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Entregados y listos
            </p>
          </CardContent>
        </Card>

        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendiente de Cobro</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${pendingRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              En proceso
            </p>
          </CardContent>
        </Card>

        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Completado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Órdenes entregadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Órdenes por estado */}
      <Card className="panel-surface rounded-xl border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Órdenes por Estado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.orders_by_status || {}).map(([status, count]) => (
              <div key={status} className="space-y-2">
                <Badge variant={getStatusBadgeVariant(status)} className="w-full justify-center">
                  {getStatusLabel(status)}
                </Badge>
                <div className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">
                    {((count / stats.total_orders) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráfica semanal y plataformas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Órdenes por semana */}
        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Últimas 4 Semanas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weeklyOrders.map(([week, count]) => (
                <div key={week}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{week}</span>
                    <span className="text-sm font-bold">{count} órdenes</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(count / Math.max(...weeklyOrders.map(w => w[1]))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Órdenes por plataforma */}
        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Por Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {platformStats.map(([platform, count]) => (
                <div key={platform}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium capitalize">{platform}</span>
                    <span className="text-sm font-bold">{count} órdenes</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(count / stats.total_orders) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.average_per_day?.toFixed(1) || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Órdenes por día</p>
          </CardContent>
        </Card>

        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.urgent_orders}</div>
            <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
          </CardContent>
        </Card>

        <Card className="panel-surface rounded-xl border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completed_today}</div>
            <p className="text-xs text-muted-foreground mt-1">Finalizadas hoy</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
