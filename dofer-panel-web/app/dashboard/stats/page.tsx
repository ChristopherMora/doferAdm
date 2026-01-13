'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
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

  const getEfficiencyBadge = (efficiency: string) => {
    switch (efficiency) {
      case 'fast':
        return 'bg-green-100 text-green-800'
      case 'average':
        return 'bg-yellow-100 text-yellow-800'
      case 'slow':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEfficiencyLabel = (efficiency: string) => {
    switch (efficiency) {
      case 'fast':
        return '🚀 Rápido'
      case 'average':
        return '⚡ Promedio'
      case 'slow':
        return '🐢 Lento'
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
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Cargando estadísticas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">No hay estadísticas disponibles aún</p>
      </div>
    )
  }

  const totalOrders = stats.reduce((sum, s) => sum + s.total_orders, 0)
  const avgEfficiency = stats.reduce((sum, s) => sum + s.estimated_vs_actual, 0) / stats.length
  const fastOperators = stats.filter(s => s.efficiency === 'fast').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📊 Estadísticas de Operadores
        </h1>
        <p className="text-gray-600">
          Análisis de rendimiento y velocidad de producción por operador
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 rounded-lg shadow p-6">
          <div className="text-sm text-blue-600 mb-1">Total Operadores</div>
          <div className="text-3xl font-bold text-blue-900">{stats.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-6">
          <div className="text-sm text-green-600 mb-1">Total Órdenes</div>
          <div className="text-3xl font-bold text-green-900">{totalOrders}</div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-6">
          <div className="text-sm text-purple-600 mb-1">Eficiencia Promedio</div>
          <div className="text-3xl font-bold text-purple-900">{avgEfficiency.toFixed(0)}%</div>
          <div className="text-xs text-purple-600 mt-1">
            {avgEfficiency < 100 ? 'Por debajo del estimado' : 'Por encima del estimado'}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-6">
          <div className="text-sm text-yellow-600 mb-1">Operadores Rápidos</div>
          <div className="text-3xl font-bold text-yellow-900">{fastOperators}</div>
          <div className="text-xs text-yellow-600 mt-1">
            {((fastOperators / stats.length) * 100).toFixed(0)}% del total
          </div>
        </div>
      </div>

      {/* Operator Rankings */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Ranking de Operadores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posición
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operador
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Órdenes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completadas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Promedio/Orden
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estimado vs Real
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eficiencia
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats
                .sort((a, b) => a.estimated_vs_actual - b.estimated_vs_actual)
                .map((operator, index) => (
                  <tr 
                    key={operator.operator_id}
                    className={index < 3 ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {operator.operator_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {operator.operator_id.substring(0, 8)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {operator.total_orders}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {operator.completed_orders}
                      </div>
                      <div className="text-xs text-gray-500">
                        {((operator.completed_orders / operator.total_orders) * 100).toFixed(0)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTime(operator.total_time_minutes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTime(operator.avg_time_minutes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">
                          {getEfficiencyIcon(operator.estimated_vs_actual)}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {operator.estimated_vs_actual.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {operator.estimated_vs_actual < 100 
                              ? 'Más rápido' 
                              : operator.estimated_vs_actual === 100
                              ? 'Exacto'
                              : 'Más lento'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEfficiencyBadge(operator.efficiency)}`}>
                        {getEfficiencyLabel(operator.efficiency)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((operator) => (
          <div 
            key={operator.operator_id} 
            className="bg-white rounded-lg shadow p-6 border-l-4"
            style={{
              borderLeftColor: 
                operator.efficiency === 'fast' ? '#10b981' :
                operator.efficiency === 'average' ? '#f59e0b' :
                '#ef4444'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {operator.operator_name}
              </h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEfficiencyBadge(operator.efficiency)}`}>
                {getEfficiencyLabel(operator.efficiency)}
              </span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Órdenes totales:</span>
                <span className="text-sm font-semibold text-gray-900">{operator.total_orders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Completadas:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {operator.completed_orders} ({((operator.completed_orders / operator.total_orders) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Tiempo total:</span>
                <span className="text-sm font-semibold text-gray-900">{formatTime(operator.total_time_minutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Promedio/orden:</span>
                <span className="text-sm font-semibold text-gray-900">{formatTime(operator.avg_time_minutes)}</span>
              </div>
              
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Precisión:</span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {getEfficiencyIcon(operator.estimated_vs_actual)} {operator.estimated_vs_actual.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      estimado vs real
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">💡 Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">🏆 Mejor Operador</h3>
            <p className="text-sm text-gray-600">
              <strong>{stats[0]?.operator_name}</strong> con {stats[0]?.estimated_vs_actual.toFixed(1)}% 
              de eficiencia (más rápido que el estimado en {(100 - stats[0]?.estimated_vs_actual).toFixed(1)}%)
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">⚡ Promedio General</h3>
            <p className="text-sm text-gray-600">
              Los operadores completan órdenes en un promedio de <strong>{avgEfficiency.toFixed(0)}%</strong> 
              {avgEfficiency < 100 ? ' por debajo' : ' por encima'} del tiempo estimado
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">📈 Total Producción</h3>
            <p className="text-sm text-gray-600">
              Se han procesado <strong>{totalOrders} órdenes</strong> con un tiempo total de producción 
              de <strong>{formatTime(stats.reduce((sum, s) => sum + s.total_time_minutes, 0))}</strong>
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">🎯 Tasa de Éxito</h3>
            <p className="text-sm text-gray-600">
              <strong>{fastOperators}</strong> operadores ({((fastOperators / stats.length) * 100).toFixed(0)}%) 
              están completando órdenes más rápido que el tiempo estimado
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
