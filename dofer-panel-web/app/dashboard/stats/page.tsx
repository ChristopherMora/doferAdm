'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, Clock, Target } from 'lucide-react'
import { OperatorStats } from '@/types'

export default function OperatorStatsPage() {
  const [stats, setStats] = useState<OperatorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response: any = await apiClient.get('/orders/operator-stats')
      setStats(response.data.operators || [])
    } catch (err: any) {
      console.error('Error fetching operator stats:', err)
      setError('Error al cargar estadísticas de operadores')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const getEfficiencyBadge = (efficiency: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (efficiency) {
      case 'fast':
        return 'default'
      case 'average':
        return 'secondary'
      case 'slow':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getEfficiencyLabel = (efficiency: string) => {
    switch (efficiency) {
      case 'fast':
        return 'Rápido'
      case 'average':
        return 'Promedio'
      case 'slow':
        return 'Lento'
      default:
        return efficiency
    }
  }

  const getEfficiencyIcon = (estimatedVsActual: number) => {
    if (estimatedVsActual <= 90) return '🏆'
    if (estimatedVsActual <= 100) return '✅'
    if (estimatedVsActual <= 110) return '⚠️'
    return '❌'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="text-sm text-muted-foreground mt-3 ml-3">Cargando estadísticas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay estadísticas disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const totalOrders = stats.reduce((sum, s) => sum + s.total_orders, 0)
  const avgEfficiency = stats.reduce((sum, s) => sum + s.estimated_vs_actual, 0) / stats.length
  const fastOperators = stats.filter(s => s.efficiency === 'fast').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estadísticas de Operadores</h1>
        <p className="text-sm text-muted-foreground mt-1">Rendimiento y velocidad de producción</p>
      </div>

      {/* Métricas resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Operadores</div>
            <div className="text-4xl font-bold tabular-nums">{stats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Órdenes Totales</div>
            <div className="text-4xl font-bold tabular-nums">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Eficiencia Promedio</div>
            <div className="text-4xl font-bold tabular-nums">{avgEfficiency.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {avgEfficiency < 100 ? 'Por debajo' : 'Por encima'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Rápidos</div>
            <div className="text-4xl font-bold tabular-nums">{fastOperators}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {((fastOperators / stats.length) * 100).toFixed(0)}% del total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">Ranking de Operadores</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Pos</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Operador</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Órdenes</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Completadas</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Tiempo Total</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden xl:table-cell">Promedio</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Precisión</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats
                    .sort((a, b) => a.estimated_vs_actual - b.estimated_vs_actual)
                    .map((operator, index) => (
                      <tr 
                        key={operator.operator_id}
                        className={`border-b hover:bg-accent transition-colors ${index < 3 ? 'bg-primary/5' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <span className="text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{operator.operator_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {operator.operator_id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium tabular-nums">
                          {operator.total_orders}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <div className="font-medium tabular-nums">{operator.completed_orders}</div>
                          <div className="text-xs text-muted-foreground">
                            {((operator.completed_orders / operator.total_orders) * 100).toFixed(0)}%
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm hidden lg:table-cell">
                          {formatTime(operator.total_time_minutes)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm hidden xl:table-cell">
                          {formatTime(operator.avg_time_minutes)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span>{getEfficiencyIcon(operator.estimated_vs_actual)}</span>
                            <div>
                              <div className="font-bold tabular-nums">{operator.estimated_vs_actual.toFixed(1)}%</div>
                              <div className="text-xs text-muted-foreground">
                                {operator.estimated_vs_actual < 100 ? 'Más rápido' : 'Más lento'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getEfficiencyBadge(operator.efficiency)}>
                            {getEfficiencyLabel(operator.efficiency)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
