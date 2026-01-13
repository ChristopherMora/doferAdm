'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Settings as SettingsIcon, DollarSign, Save, CheckCircle2 } from 'lucide-react'
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
  const { addToast } = useToast()
  const [settings, setSettings] = useState<CostSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('costs')
  const [hasChanges, setHasChanges] = useState(false)

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

    // Validaciones
    if (settings.material_cost_per_gram <= 0) {
      addToast({
        title: 'Costo de material inválido',
        description: 'El costo debe ser mayor a 0',
        variant: 'warning'
      })
      return
    }

    if (settings.profit_margin_percentage < 0 || settings.profit_margin_percentage > 100) {
      addToast({
        title: 'Margen inválido',
        description: 'El margen debe estar entre 0% y 100%',
        variant: 'warning'
      })
      return
    }

    try {
      setSaving(true)
      await apiClient.put('/costs/settings', {
        material_cost_per_gram: settings.material_cost_per_gram,
        electricity_cost_per_hour: settings.electricity_cost_per_hour,
        labor_cost_per_hour: settings.labor_cost_per_hour,
        profit_margin_percentage: settings.profit_margin_percentage,
      })
      
      addToast({
        title: 'Configuración guardada',
        description: 'Los cambios se aplicarán en los nuevos cálculos',
        variant: 'success'
      })
      
      setHasChanges(false)
      loadSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      addToast({
        title: 'Error al guardar',
        description: 'No se pudo guardar la configuración',
        variant: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona la configuración del sistema
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 ml-3 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Cambios sin guardar
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <nav className="flex border-b">
            <button
              onClick={() => setActiveTab('costs')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'costs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Costos y Precios
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'calculator'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Calculadora
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <SettingsIcon className="h-4 w-4 inline mr-2" />
              General
            </button>
          </nav>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'costs' && settings && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold mb-1">
                Configuración de Costos de Producción
              </h3>
              <p className="text-sm text-muted-foreground">
                Define los costos base que se utilizarán para calcular el precio de venta
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Costo de material por kilo (MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.material_cost_per_gram}
                  onChange={(e) => {
                    setSettings({ ...settings, material_cost_per_gram: parseFloat(e.target.value) || 0 })
                    setHasChanges(true)
                  }}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Costo del filamento por kilo (se divide automáticamente por gramo)</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Costo de electricidad por hora (MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.electricity_cost_per_hour}
                  onChange={(e) => {
                    setSettings({ ...settings, electricity_cost_per_hour: parseFloat(e.target.value) || 0 })
                    setHasChanges(true)
                  }}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Consumo eléctrico de la impresora</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Costo de mano de obra por hora (MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.labor_cost_per_hour}
                  onChange={(e) => {
                    setSettings({ ...settings, labor_cost_per_hour: parseFloat(e.target.value) || 0 })
                    setHasChanges(true)
                  }}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Incluye supervisión, post-proceso, etc.</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Margen de ganancia (%)
                </label>
                <input
                  type="number"
                  step="1"
                  value={settings.profit_margin_percentage}
                  onChange={(e) => {
                    setSettings({ ...settings, profit_margin_percentage: parseFloat(e.target.value) || 0 })
                    setHasChanges(true)
                  }}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Porcentaje de ganancia sobre costos</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Última actualización: {new Date(settings.updated_at).toLocaleString('es-MX')}
              </p>
              <Button
                onClick={saveSettings}
                disabled={saving || !hasChanges}
                className="min-w-[180px]"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                    Guardando...
                  </>
                ) : hasChanges ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Guardado
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'calculator' && (
        <Card>
          <CardContent className="p-6">
            <CalculadoraCostos />
          </CardContent>
        </Card>
      )}

      {activeTab === 'general' && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold mb-2">Configuración General</h3>
            <p className="text-sm text-muted-foreground">
              Próximamente: Configuración de email, logo, tema, etc.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
