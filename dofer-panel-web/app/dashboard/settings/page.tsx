'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import CalculadoraCostos from '@/components/CalculadoraCostos'

interface CostSettings {
  id: string
  material_cost_per_gram: number
  electricity_cost_per_hour: number
  labor_cost_per_hour: number
  profit_margin_percentage: number
  updated_at: string
  updated_by: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CostSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('costs')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<CostSettings>('/costs/settings')
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      await apiClient.put('/costs/settings', {
        material_cost_per_gram: settings.material_cost_per_gram,
        electricity_cost_per_hour: settings.electricity_cost_per_hour,
        labor_cost_per_hour: settings.labor_cost_per_hour,
        profit_margin_percentage: settings.profit_margin_percentage,
      })
      alert('✅ Configuración guardada exitosamente')
      loadSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('❌ Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando configuración...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚙️ Configuración</h1>
          <p className="text-gray-600">Gestiona la configuración del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('costs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'costs'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            💰 Costos y Precios
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'calculator'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🧮 Calculadora
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🔧 General
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'costs' && settings && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuración de Costos de Producción
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Define los costos base que se utilizarán para calcular el precio de venta
            </p>
          </div>

          {/* Cost Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                💎 Costo de material por kilo (MXN)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.material_cost_per_gram}
                onChange={(e) =>
                  setSettings({ ...settings, material_cost_per_gram: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              />
              <p className="text-xs text-gray-500 mt-1">Costo del filamento por kilo (se divide automáticamente por gramo)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                ⚡ Costo de electricidad por hora (MXN)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.electricity_cost_per_hour}
                onChange={(e) =>
                  setSettings({ ...settings, electricity_cost_per_hour: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              />
              <p className="text-xs text-gray-500 mt-1">Consumo eléctrico de la impresora</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                👷 Costo de mano de obra por hora (MXN)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.labor_cost_per_hour}
                onChange={(e) =>
                  setSettings({ ...settings, labor_cost_per_hour: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              />
              <p className="text-xs text-gray-500 mt-1">Incluye supervisión, post-proceso, etc.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                📈 Margen de ganancia (%)
              </label>
              <input
                type="number"
                step="1"
                value={settings.profit_margin_percentage}
                onChange={(e) =>
                  setSettings({ ...settings, profit_margin_percentage: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              />
              <p className="text-xs text-gray-500 mt-1">Porcentaje de ganancia sobre costos</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-gray-500">
              Última actualización: {new Date(settings.updated_at).toLocaleString('es-MX')}
            </p>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : '💾 Guardar Configuración'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'calculator' && (
        <div className="bg-white rounded-lg shadow p-6">
          <CalculadoraCostos />
        </div>
      )}

      {activeTab === 'general' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración General</h3>
          <p className="text-gray-600">
            Próximamente: Configuración de email, logo, tema, etc.
          </p>
        </div>
      )}
    </div>
  )
}
