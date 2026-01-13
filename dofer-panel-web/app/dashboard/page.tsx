'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

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
      if (diffHours < 24) return setRelativeTime(`Hace ${diffHours}h`)
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
  }

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

  // Métricas de acción inmediata - enfocadas en operación
  const actionMetrics = [
    { label: 'Urgentes', value: stats.urgent_orders, sublabel: 'requieren atención' },
    { label: 'Vencen en 48h', value: dueSoonCount, sublabel: 'próximas a vencer' },
    { label: 'Vencidas', value: overdueCount, sublabel: 'fuera de plazo' },
  ]

  // Métricas de contexto - estado general
  const contextMetrics = [
    { label: stats.total_orders, sublabel: 'total órdenes' },
    { label: stats.today_orders, sublabel: 'hoy' },
    { label: stats.completed_today, sublabel: 'completadas hoy' },
  ]

  const statusConfig: Record<string, { label: string; icon: any; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    new: { label: 'Nuevas', icon: Sparkles, variant: 'default' },
    printing: { label: 'Imprimiendo', icon: Printer, variant: 'secondary' },
    post: { label: 'Post-Proceso', icon: Wrench, variant: 'secondary' },
    packed: { label: 'Empacadas', icon: PackageCheck, variant: 'secondary' },
    ready: { label: 'Listas', icon: CheckCircle2, variant: 'default' },
    delivered: { label: 'Entregadas', icon: Truck, variant: 'outline' },
    cancelled: { label: 'Canceladas', icon: FileX, variant: 'destructive' },
  }

  const statusCards = Object.entries(stats.orders_by_status).map(([status, count]) => ({
    ...(statusConfig[status] || { label: status, icon: Package, variant: 'outline' as const }),
    value: count,
    status
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con acciones principales */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centro de Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lastUpdate && (
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isRefreshing ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`} />
                {isRefreshing ? 'Actualizando...' : relativeTime}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={loadDashboardData} disabled={isRefreshing} variant="outline" size="sm" className="h-9">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link href="/dashboard/orders/new">
            <Button size="default" className="h-10 px-6 text-base font-semibold elevated-md hover:elevated-lg transition-all">
              <Plus className="h-5 w-5 mr-2" />
              Nueva Orden
            </Button>
          </Link>
          <Link href="/dashboard/quotes/new">
            <Button variant="secondary" size="default" className="h-10 px-5">
              <FileText className="h-4 w-4 mr-2" />
              Cotización
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de backend desconectado */}
      {!backendConnected && (
        <Card className="border-2 border-destructive bg-destructive/10 elevated-lg animate-pulse">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-destructive/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            </div>
            <div>
              <p className="text-base font-semibold text-destructive">Backend no conectado</p>
              <p className="text-sm text-muted-foreground mt-0.5">El servidor API no está respondiendo</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Métricas de acción - qué hacer ahora */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold">Acción Requerida</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {actionMetrics.map((metric, i) => {
            const isUrgent = metric.value > 0
            return (
              <Card key={i} className={`${
                isUrgent 
                  ? 'card-glow border-2 border-primary/40 bg-gradient-to-br from-card to-primary/5' 
                  : 'elevated-sm hover:elevated-md transition-all'
              }`}>
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className={`text-6xl font-black tabular-nums ${
                      isUrgent ? 'text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'text-foreground'
                    }`}>
                      {metric.value}
                    </span>
                    {isUrgent && <Flame className="h-6 w-6 text-primary mb-2 animate-pulse" />}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{metric.sublabel}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Métricas de contexto - estado general */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold">Estado General</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {contextMetrics.map((metric, i) => (
            <Card key={i} className="elevated-sm hover:elevated-md transition-all hover:-translate-y-0.5">
              <CardContent className="pt-6 pb-5">
                <div className="text-6xl font-black tabular-nums bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                  {metric.label}
                </div>
                <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">{metric.sublabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Flujo de trabajo - estados de órdenes */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold">Flujo de Trabajo</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <Card className="elevated-md">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {statusCards.map((card) => (
                <div 
                  key={card.status} 
                  className="group flex flex-col items-center text-center space-y-3 p-4 rounded-xl border-2 border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer hover:scale-105 hover:-translate-y-1 elevated-sm hover:elevated-lg"
                >
                  <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <card.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-4xl font-black tabular-nums group-hover:text-primary transition-colors">{card.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{card.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Órdenes recientes - tabla operativa */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold">Órdenes Recientes</h2>
            <Link href="/dashboard/orders">
              <Button variant="ghost" size="sm" className="text-xs h-8 hover:text-primary transition-colors">
                Ver todas →
              </Button>
            </Link>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <Card className="elevated-md overflow-hidden">
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 backdrop-blur-sm">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-4 px-5 text-xs text-muted-foreground font-bold uppercase tracking-widest"># Orden</th>
                    <th className="text-left py-4 px-5 text-xs text-muted-foreground font-bold uppercase tracking-widest">Cliente</th>
                    <th className="text-left py-4 px-5 text-xs text-muted-foreground font-bold uppercase tracking-widest hidden sm:table-cell">Producto</th>
                    <th className="text-left py-4 px-5 text-xs text-muted-foreground font-bold uppercase tracking-widest">Estado</th>
                    <th className="text-left py-4 px-5 text-xs text-muted-foreground font-bold uppercase tracking-widest hidden md:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentOrders.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No hay órdenes registradas</p>
                      </div>
                    </td></tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-accent transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/orders/${order.id}`}>
                        <td className="py-3 px-4">
                          <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-sm hover:text-primary">{order.order_number}</Link>
                        </td>
                        <td className="py-3 px-4 font-medium">{order.customer_name}</td>
                        <td className="py-3 px-4 text-muted-foreground text-sm hidden sm:table-cell">{order.product_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={statusConfig[order.status]?.variant || 'outline'}>{order.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm hidden md:table-cell">
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
