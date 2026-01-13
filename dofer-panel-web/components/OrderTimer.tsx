'use client'

import { useState, useEffect, useCallback } from 'react'
import { TimerState } from '@/types'
import { apiClient } from '@/lib/api'

interface OrderTimerProps {
  orderId: string
  estimatedMinutes?: number
}

export default function OrderTimer({ orderId, estimatedMinutes = 0 }: OrderTimerProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(estimatedMinutes)
  const [isEditingEstimated, setIsEditingEstimated] = useState(false)
  const [tempEstimated, setTempEstimated] = useState(estimatedMinutes)

  // Fetch timer state
  const fetchTimerState = useCallback(async () => {
    try {
      const response: any = await apiClient.get(`/orders/${orderId}/timer`)
      const state: TimerState = response.data
      setTimerState(state)
      setEstimatedTime(state.estimated_time_minutes)
      setTempEstimated(state.estimated_time_minutes)
      
      // Calculate current running time
      if (state.is_timer_running && state.timer_started_at) {
        const startTime = new Date(state.timer_started_at).getTime()
        const now = Date.now()
        const elapsed = Math.floor((now - startTime) / 1000 / 60) // minutes
        setCurrentTime(state.actual_time_minutes + elapsed)
      } else {
        setCurrentTime(state.actual_time_minutes)
      }
    } catch (err: any) {
      console.error('Error fetching timer state:', err)
      setError(err.response?.data?.error || 'Error al cargar el timer')
    }
  }, [orderId])

  // Initial load and periodic refresh
  useEffect(() => {
    fetchTimerState()
    const interval = setInterval(fetchTimerState, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [fetchTimerState])

  // Update current time every second when timer is running
  useEffect(() => {
    if (timerState?.is_timer_running) {
      const interval = setInterval(() => {
        setCurrentTime(prev => prev + (1/60)) // Add 1 second in minutes
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timerState?.is_timer_running])

  const handleStartTimer = async () => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post(`/orders/${orderId}/timer/start`, {})
      await fetchTimerState()
    } catch (err: any) {
      setError(err.response?.data || 'Error al iniciar el timer')
    } finally {
      setLoading(false)
    }
  }

  const handlePauseTimer = async () => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post(`/orders/${orderId}/timer/pause`, {})
      await fetchTimerState()
    } catch (err: any) {
      setError(err.response?.data || 'Error al pausar el timer')
    } finally {
      setLoading(false)
    }
  }

  const handleStopTimer = async () => {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post(`/orders/${orderId}/timer/stop`, {})
      await fetchTimerState()
    } catch (err: any) {
      setError(err.response?.data || 'Error al detener el timer')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEstimatedTime = async () => {
    if (tempEstimated === estimatedTime) {
      setIsEditingEstimated(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      await apiClient.patch(`/orders/${orderId}/estimated-time`, {
        minutes: tempEstimated
      })
      setEstimatedTime(tempEstimated)
      setIsEditingEstimated(false)
      await fetchTimerState()
    } catch (err: any) {
      setError(err.response?.data || 'Error al actualizar tiempo estimado')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    if (percentage < 100) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const percentage = estimatedTime > 0 ? Math.min((currentTime / estimatedTime) * 100, 100) : 0

  if (!timerState) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Cargando timer...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">⏱️ Cronómetro de Producción</h3>
        <div className="flex items-center space-x-2">
          {timerState.is_timer_running && (
            <span className="animate-pulse h-3 w-3 bg-green-500 rounded-full"></span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Timer Display */}
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <div className="text-5xl font-bold text-gray-900 mb-2">
          {formatTime(currentTime)}
        </div>
        <div className="text-sm text-gray-500">
          Tiempo actual de producción
        </div>
      </div>

      {/* Progress Bar */}
      {estimatedTime > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progreso</span>
            <span>{percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(percentage)}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Time Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 mb-1">Tiempo Estimado</div>
          {isEditingEstimated ? (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={tempEstimated}
                onChange={(e) => setTempEstimated(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 border border-blue-300 rounded text-sm"
                min="0"
              />
              <button
                onClick={handleUpdateEstimatedTime}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                disabled={loading}
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setIsEditingEstimated(false)
                  setTempEstimated(estimatedTime)
                }}
                className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
              >
                ✕
              </button>
            </div>
          ) : (
            <div 
              className="text-2xl font-bold text-blue-900 cursor-pointer hover:bg-blue-100 rounded px-2"
              onClick={() => setIsEditingEstimated(true)}
            >
              {formatTime(estimatedTime)}
            </div>
          )}
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 mb-1">Tiempo Real</div>
          <div className="text-2xl font-bold text-green-900">
            {formatTime(timerState.actual_time_minutes)}
          </div>
        </div>
      </div>

      {/* Remaining Time */}
      {estimatedTime > 0 && (
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-sm text-purple-600 mb-1">Tiempo Restante Estimado</div>
          <div className="text-2xl font-bold text-purple-900">
            {currentTime >= estimatedTime 
              ? 'Tiempo excedido' 
              : formatTime(estimatedTime - currentTime)
            }
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex space-x-3 pt-4">
        {!timerState.is_timer_running ? (
          <button
            onClick={handleStartTimer}
            disabled={loading}
            className="flex-1 bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            ▶️ Iniciar
          </button>
        ) : (
          <button
            onClick={handlePauseTimer}
            disabled={loading}
            className="flex-1 bg-yellow-500 text-white px-4 py-3 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            ⏸️ Pausar
          </button>
        )}
        
        <button
          onClick={handleStopTimer}
          disabled={loading}
          className="flex-1 bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          ⏹️ Detener
        </button>
      </div>

      {/* Timer Stats */}
      <div className="border-t pt-4 mt-4 space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Estado:</span>
          <span className="font-semibold">
            {timerState.is_timer_running ? '🟢 Corriendo' : '⚫ Detenido'}
          </span>
        </div>
        {timerState.timer_started_at && (
          <div className="flex justify-between">
            <span>Última sesión iniciada:</span>
            <span>{new Date(timerState.timer_started_at).toLocaleTimeString()}</span>
          </div>
        )}
        {estimatedTime > 0 && (
          <div className="flex justify-between">
            <span>Eficiencia:</span>
            <span className={`font-semibold ${
              percentage < 100 ? 'text-green-600' : 
              percentage < 120 ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {percentage < 100 ? '✓ Dentro del tiempo' : 
               percentage < 120 ? '⚠️ Cerca del límite' : 
               '❌ Tiempo excedido'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
