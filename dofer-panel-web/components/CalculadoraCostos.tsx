'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import STLUploader from './STLUploader'
import type { STLMetrics } from '@/lib/stlParser'

interface CostSettings {
  material_cost_per_gram: number
  electricity_cost_per_hour: number
  labor_cost_per_hour: number
  profit_margin_percentage: number
}

interface CostBreakdown {
  material_cost: number
  labor_cost: number
  electricity_cost: number
  other_costs: number
  subtotal: number
  profit_margin: number
  unit_price: number
  total: number
}

interface CalculadoraCostosProps {
  onCalculated?: (breakdown: CostBreakdown) => void
}

export default function CalculadoraCostos({ onCalculated }: CalculadoraCostosProps) {
  const [settings, setSettings] = useState<CostSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null)

  // Inputs
  const [weightGrams, setWeightGrams] = useState<number>(0)
  const [printTimeHours, setPrintTimeHours] = useState<number>(0)
  const [quantity, setQuantity] = useState<number>(1)
  const [otherCosts, setOtherCosts] = useState<number>(0)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await apiClient.get<CostSettings>('/costs/settings')
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const calculateCost = async () => {
    if (!weightGrams || !printTimeHours || !quantity) {
      alert('Por favor completa peso, tiempo y cantidad')
      return
    }

    try {
      setLoading(true)
      const data = await apiClient.post<CostBreakdown>('/costs/calculate', {
        weight_grams: weightGrams,
        print_time_hours: printTimeHours,
        quantity: quantity,
        other_costs: otherCosts,
      })
      setBreakdown(data)
      if (onCalculated) {
        onCalculated(data)
      }
    } catch (error) {
      console.error('Error calculating cost:', error)
      alert('Error al calcular costos')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* STL Uploader Section */}
      <div className="border rounded-lg p-6 bg-gray-50">
        <STLUploader
          onAnalyzed={(metrics: STLMetrics, weight: number, timeHours: number) => {
            setWeightGrams(weight)
            setPrintTimeHours(timeHours)
          }}
        />
      </div>

      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900">💰 Calculadora de Costos</h2>
        <p className="text-sm text-gray-600 mt-1">
          Calcula costos de producción y precio sugerido
        </p>
      </div>

      {/* Settings Info */}
      {settings && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">⚙️ Configuración Actual</h3>
          <div className="grid grid-cols-2 gap-3 text-sm text-blue-800">
            <div>
              <span className="font-medium">Material:</span> {formatCurrency(settings.material_cost_per_gram)}/g
            </div>
            <div>
              <span className="font-medium">Electricidad:</span> {formatCurrency(settings.electricity_cost_per_hour)}/h
            </div>
            <div>
              <span className="font-medium">Mano de obra:</span> {formatCurrency(settings.labor_cost_per_hour)}/h
            </div>
            <div>
              <span className="font-medium">Margen:</span> {settings.profit_margin_percentage}%
            </div>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Peso del producto (gramos)
          </label>
          <input
            type="number"
            value={weightGrams || ''}
            onChange={(e) => setWeightGrams(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
            placeholder="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Tiempo de impresión (horas)
          </label>
          <input
            type="number"
            step="0.1"
            value={printTimeHours || ''}
            onChange={(e) => setPrintTimeHours(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
            placeholder="5.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Cantidad
          </label>
          <input
            type="number"
            value={quantity || ''}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
            placeholder="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Otros costos (opcional)
          </label>
          <input
            type="number"
            value={otherCosts || ''}
            onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
            placeholder="0"
          />
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateCost}
        disabled={loading}
        className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Calculando...' : '🧮 Calcular Costos'}
      </button>

      {/* Results */}
      {breakdown && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-bold text-green-900">✅ Resultado del Cálculo</h3>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Costo de material:</span>
              <span className="font-medium">{formatCurrency(breakdown.material_cost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Costo de mano de obra:</span>
              <span className="font-medium">{formatCurrency(breakdown.labor_cost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Costo de electricidad:</span>
              <span className="font-medium">{formatCurrency(breakdown.electricity_cost)}</span>
            </div>
            {breakdown.other_costs > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Otros costos:</span>
                <span className="font-medium">{formatCurrency(breakdown.other_costs)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-gray-700 font-medium">Subtotal de costos:</span>
              <span className="font-bold">{formatCurrency(breakdown.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-700">
              <span className="font-medium">Margen de ganancia:</span>
              <span className="font-bold">+{formatCurrency(breakdown.profit_margin)}</span>
            </div>
          </div>

          {/* Final Prices */}
          <div className="bg-white rounded-lg p-4 space-y-2 border-2 border-green-300">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Precio unitario:</span>
              <span className="text-xl font-bold text-indigo-600">
                {formatCurrency(breakdown.unit_price)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-gray-900 font-bold text-lg">Total ({quantity} {quantity === 1 ? 'pieza' : 'piezas'}):</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(breakdown.total)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1">
            <p className="text-xs text-gray-600 italic">
              💡 Este precio incluye costos de producción + margen de ganancia configurado
            </p>
            <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ Este es un precio estimado. El costo final puede variar según la configuración de impresión, soportes, y otros factores.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
