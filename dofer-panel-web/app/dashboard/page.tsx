'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  RefreshCw, Plus, FileText, Package, Calendar, Flame, CheckCircle2, 
  Clock, XCircle, BarChart3, AlertTriangle, Printer, Wrench, 
  PackageCheck, Truck, FileX, Sparkles
} from 'lucide-react'

interface OrderStats {
  total_orders: number
  orders_by_status: Record<string, number>
  urgent_orders: number
  today_orders: number
  completed_today: number
  average_per_day: number
}

// Memoizar card de estadísticas
const StatsCard = memo(({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend 
}: { 
  title: string
  value: string | number
  description: string
  icon: any
  trend?: string
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {trend && <p className="text-xs text-green-600 mt-1">{trend}</p>}
    </CardContent>
  </Card>
))

StatsCard.displayName = 'StatsCard'

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

  const loadDashboardData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      if (!hasLoadedRef.current) setLoading(true)
      
      const statsData = await apiClient.get<OrderStats>('/orders/stats')
      setStats(statsData)

      const response = await apiClient.get<{ orders: any[] }>('/orders?limit=5')
      setRecentOrders(response.orders || [])
      
      const allOrdersResponse = await apiClient.get<{ orders: any[] }>('/orders?limit=1000')
      const allOrders = allOrdersResponse.orders || []
      
      let dueSoon = 0, overdue = 0
      const now = new Date()
      
      allOrders.forEach((order: any) => {
        if (order.delivery_deadline && !['delivered', 'cancelled'].includes(order.status)) {
          const deadline = new Date(order.delivery_deadline)
          const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 0) overdue++
          else if (diffDays <= 2) dueSoon++
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
      if (!hasLoadedRef.current) {
        setStats({ total_orders: 0, orders_by_status: {}, urgent_orders: 0, today_orders: 0, completed_today: 0, average_per_day: 0 })
        setRecentOrders([])
      }
      hasLoadedRef.current = true
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [loadDashboardData])

  useEffect(() => {
    if (!lastUpdate) return

    const updateRelativeTime = () => {
      const diffMs = Date.now() - lastUpdate.getTime()
      if (diffMs < 5000) return setRelativeTime('Justo ahora')
      const diffSeconds = Math.floor(diffMs / 1000)
      if (diffSeconds < 60) return setRelativeTime(`Hace ${diffSeconds}s`)
      const diffMinutes = Math.floor(diffSeconds / 60)
      if (diffMinutes < 60) return setRelativeTime(`Hace ${diffMinutes}m`)
      const diffHours = Math.floor(diffMinutes / 60)
      setRelativeTime(`Hace ${diffHours}h`)
    }

    updateRelativeTime()
    const interval = setInterval(updateRelativeTime, 5000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  // Métricas de acción inmediata - enfocadas en operación
  const actionMetrics = useMemo(() => !stats ? [] : [
    { 
      label: 'Urgentes', 
      value: stats.urgent_orders, 
      sublabel: 'requieren atención',
      icon: Flame,
      color: 'text-red-500',
      iconBg: 'bg-red-500/10',
      borderColor: 'border-red-500/30'
    },
    { 
      label: 'Vencen en 48h', 
      value: dueSoonCount, 
      sublabel: 'próximas a vencer',
      icon: Clock,
      color: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30'
    },
    { 
      label: 'Vencidas', 
      value: overdueCount, 
      sublabel: 'fuera de plazo',
      icon: XCircle,
      color: 'text-rose-500',
      iconBg: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30'
    },
  ], [stats, dueSoonCount, overdueCount])

  // Métricas de contexto - estado general
  const contextMetrics = useMemo(() => !stats ? [] : [
    { 
      label: stats.total_orders, 
      sublabel: 'total órdenes',
      icon: Package,
      color: 'text-primary',
      iconBg: 'bg-primary/10'
    },
    { 
      label: stats.today_orders, 
      sublabel: 'hoy',
      icon: Calendar,
      color: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10'
    },
    { 
      label: stats.completed_today, 
      sublabel: 'completadas hoy',
      icon: CheckCircle2,
      color: 'text-green-500',
      iconBg: 'bg-green-500/10'
    },
  ], [stats])

  const statusConfig: Record<string, { label: string; icon: any; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string; iconBg: string }> = useMemo(() => ({
    new: { 
      label: 'Nuevas', 
      icon: Sparkles, 
      variant: 'default',
      color: 'text-yellow-500',
      iconBg: 'bg-yellow-500/10'
    },
    printing: { 
      label: 'Imprimiendo', 
      icon: Printer, 
      variant: 'secondary',
      color: 'text-purple-500',
      iconBg: 'bg-purple-500/10'
    },
    post: { 
      label: 'Post-Proceso', 
      icon: Wrench, 
      variant: 'secondary',
      color: 'text-blue-500',
      iconBg: 'bg-blue-500/10'
    },
    packed: { 
      label: 'Empacadas', 
      icon: PackageCheck, 
      variant: 'secondary',
      color: 'text-primary',
      iconBg: 'bg-primary/10'
    },
    ready: { 
      label: 'Listas', 
      icon: CheckCircle2, 
      variant: 'default',
      color: 'text-green-500',
      iconBg: 'bg-green-500/10'
    },
    delivered: { 
      label: 'Entregadas', 
      icon: Truck, 
      variant: 'outline',
      color: 'text-muted-foreground',
      iconBg: 'bg-muted'
    },
    cancelled: { 
      label: 'Canceladas', 
      icon: FileX, 
      variant: 'destructive',
      color: 'text-red-500',
      iconBg: 'bg-red-500/10'
    },
  }), [])

  const statusCards = useMemo(() => !stats ? [] : Object.entries(stats.orders_by_status).map(([status, count]) => ({
    ...(statusConfig[status] || { 
      label: status, 
      icon: Package, 
      variant: 'outline' as const,
      color: 'text-muted-foreground',
      iconBg: 'bg-muted'
    }),
    value: count,
    status
  })), [stats, statusConfig])

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 pb-5">
                <Skeleton className="h-12 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 pb-5">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con acciones principales */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            {lastUpdate && (
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isRefreshing ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`} />
                {isRefreshing ? 'Actualizando...' : relativeTime}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={loadDashboardData} disabled={isRefreshing} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link href="/dashboard/orders/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Orden
            </Button>
          </Link>
          <Link href="/dashboard/quotes/new">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Cotización
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de backend desconectado */}
      {!backendConnected && (
        <Card className="border-destructive/50 bg-destructive/10 mb-8">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 bg-destructive/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Backend no conectado</p>
              <p className="text-xs text-muted-foreground mt-1">El servidor API no está respondiendo</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Métricas de acción - qué hacer ahora */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold">Acción Requerida</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {actionMetrics.map((metric, i) => {
            const isUrgent = metric.value > 0
            const Icon = metric.icon
            return (
              <Card key={i} className={`${isUrgent ? `border-l-4 ${metric.borderColor}` : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${metric.iconBg}`}>
                      <Icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                    <span className={`text-4xl font-bold tabular-nums ${isUrgent ? metric.color : 'text-muted-foreground'}`}>
                      {metric.value}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">{metric.sublabel}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Métricas de contexto - estado general */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold">Estado General</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {contextMetrics.map((metric, i) => {
            const Icon = metric.icon
            return (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${metric.iconBg}`}>
                      <Icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                    <span className={`text-4xl font-bold tabular-nums ${metric.color}`}>
                      {metric.label}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground">{metric.sublabel}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Flujo de trabajo - estados de órdenes */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold">Flujo de Trabajo</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          {statusCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.status}>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`p-3 rounded-lg ${card.iconBg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div className={`text-3xl font-bold tabular-nums ${card.color}`}>
                      {card.value}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">{card.label}</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Órdenes recientes - tabla operativa */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold">Órdenes Recientes</h2>
          </div>
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm" className="text-xs">
              Ver todas →
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground"># Orden</th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground hidden sm:table-cell">Producto</th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentOrders.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No hay órdenes registradas</p>
                      </div>
                    </td></tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                        <td className="py-4 px-6">
                          <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-sm font-medium hover:text-primary">{order.order_number}</Link>
                        </td>
                        <td className="py-4 px-6 font-medium">{order.customer_name}</td>
                        <td className="py-4 px-6 text-muted-foreground hidden sm:table-cell">{order.product_name}</td>
                        <td className="py-4 px-6">
                          <Badge variant={statusConfig[order.status]?.variant || 'outline'}>{order.status}</Badge>
                        </td>
                        <td className="py-4 px-6 text-muted-foreground hidden md:table-cell">
                          {new Date(order.created_at).toLocaleDateString('es-MX')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
