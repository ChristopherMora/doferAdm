'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

interface QuoteTemplate {
  id: string
  name: string
  description: string
  material: string
  infill_percentage: number
  layer_height: number
  print_speed: number
  base_cost: number
  markup_percentage: number
  created_at: string
}

export default function QuoteTemplatesPage() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    material: 'PLA',
    infill_percentage: 20,
    layer_height: 0.2,
    print_speed: 50,
    base_cost: 0,
    markup_percentage: 30
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await apiClient.get('/quotes/templates')
      setTemplates((data as any).templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/quotes/templates', formData)
      await loadTemplates()
      setShowForm(false)
      setFormData({
        name: '',
        description: '',
        material: 'PLA',
        infill_percentage: 20,
        layer_height: 0.2,
        print_speed: 50,
        base_cost: 0,
        markup_percentage: 30
      })
    } catch (error) {
      console.error('Error creating template:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    
    try {
      await apiClient.delete(`/quotes/templates/${id}`)
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleUseTemplate = (template: QuoteTemplate) => {
    // Navegar a crear cotización con datos de la plantilla
    const params = new URLSearchParams({
      material: template.material,
      infill: template.infill_percentage.toString(),
      layer_height: template.layer_height.toString(),
      markup: template.markup_percentage.toString()
    })
    window.location.href = `/dashboard/quotes/new?${params}`
  }

  if (loading) {
    return <div className="p-8">Cargando plantillas...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Plantillas de Cotización</h1>
          <p className="text-muted-foreground mt-1">
            Crea plantillas rápidas para cotizaciones frecuentes
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          {showForm ? 'Cancelar' : '+ Nueva Plantilla'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Nueva Plantilla</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Material</label>
              <select
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="PLA">PLA</option>
                <option value="ABS">ABS</option>
                <option value="PETG">PETG</option>
                <option value="TPU">TPU</option>
                <option value="Resin">Resina</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Relleno (%)</label>
              <input
                type="number"
                value={formData.infill_percentage}
                onChange={(e) => setFormData({ ...formData, infill_percentage: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="100"
                step="5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Altura de capa (mm)</label>
              <input
                type="number"
                value={formData.layer_height}
                onChange={(e) => setFormData({ ...formData, layer_height: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0.1"
                max="0.4"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Velocidad (mm/s)</label>
              <input
                type="number"
                value={formData.print_speed}
                onChange={(e) => setFormData({ ...formData, print_speed: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="20"
                max="100"
                step="5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Costo base ($)</label>
              <input
                type="number"
                value={formData.base_cost}
                onChange={(e) => setFormData({ ...formData, base_cost: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Margen de ganancia (%)</label>
              <input
                type="number"
                value={formData.markup_percentage}
                onChange={(e) => setFormData({ ...formData, markup_percentage: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="200"
                step="5"
              />
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Guardar Plantilla
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg">{template.name}</h3>
              <button
                onClick={() => handleDelete(template.id)}
                className="text-red-500 hover:text-red-700"
              >
                🗑️
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
            
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium">{template.material}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Relleno:</span>
                <span className="font-medium">{template.infill_percentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capa:</span>
                <span className="font-medium">{template.layer_height}mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margen:</span>
                <span className="font-medium">{template.markup_percentage}%</span>
              </div>
            </div>

            <button
              onClick={() => handleUseTemplate(template)}
              className="w-full px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-medium"
            >
              Usar Plantilla
            </button>
          </div>
        ))}

        {templates.length === 0 && !showForm && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No hay plantillas. Crea una para comenzar.
          </div>
        )}
      </div>
    </div>
  )
}
