'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface QuoteTemplate {
  id: string
  name: string
  description?: string
  material: string
  infill_percentage: number
  layer_height: number
  print_speed: number
  base_cost: number
  markup_percentage: number
  created_at: string
  updated_at?: string
}

interface QuoteTemplatesResponse {
  templates: QuoteTemplate[]
}

type TemplateForm = {
  name: string
  description: string
  material: string
  infill_percentage: number
  layer_height: number
  print_speed: number
  base_cost: number
  markup_percentage: number
}

const MATERIAL_OPTIONS = ['PLA', 'ABS', 'PETG', 'TPU', 'Resin']

const initialForm: TemplateForm = {
  name: '',
  description: '',
  material: 'PLA',
  infill_percentage: 20,
  layer_height: 0.2,
  print_speed: 50,
  base_cost: 0,
  markup_percentage: 30,
}

export default function QuoteTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<QuoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [materialFilter, setMaterialFilter] = useState('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplateID, setEditingTemplateID] = useState<string | null>(null)
  const [formData, setFormData] = useState<TemplateForm>(initialForm)

  const loadTemplates = useCallback(async () => {
    setError(null)

    try {
      setLoading(true)
      const response = await apiClient.get<QuoteTemplatesResponse>('/quotes/templates')
      setTemplates(response.templates || [])
    } catch (error: unknown) {
      setTemplates([])
      setError(`Error al cargar plantillas: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const resetEditor = () => {
    setEditorOpen(false)
    setEditingTemplateID(null)
    setFormData(initialForm)
  }

  const openCreateEditor = () => {
    setError(null)
    setNotice(null)
    setEditingTemplateID(null)
    setFormData(initialForm)
    setEditorOpen(true)
  }

  const openEditEditor = (template: QuoteTemplate) => {
    setError(null)
    setNotice(null)
    setEditingTemplateID(template.id)
    setFormData({
      name: template.name,
      description: template.description || '',
      material: template.material,
      infill_percentage: template.infill_percentage,
      layer_height: template.layer_height,
      print_speed: template.print_speed,
      base_cost: template.base_cost,
      markup_percentage: template.markup_percentage,
    })
    setEditorOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const payload: TemplateForm = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      material: formData.material.trim() || 'PLA',
    }

    if (!payload.name) {
      setSubmitting(false)
      setError('El nombre de la plantilla es obligatorio.')
      return
    }

    try {
      if (editingTemplateID) {
        const updated = await apiClient.put<QuoteTemplate>(`/quotes/templates/${editingTemplateID}`, payload)
        setTemplates((prev) => prev.map((template) => (template.id === editingTemplateID ? updated : template)))
        setNotice('Plantilla actualizada correctamente.')
      } else {
        const created = await apiClient.post<QuoteTemplate>('/quotes/templates', payload)
        setTemplates((prev) => [created, ...prev])
        setNotice('Plantilla creada correctamente.')
      }

      resetEditor()
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error guardando plantilla'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta plantilla?')) {
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      await apiClient.delete(`/quotes/templates/${id}`)
      setTemplates((prev) => prev.filter((template) => template.id !== id))
      setNotice('Plantilla eliminada.')
      if (editingTemplateID === id) {
        resetEditor()
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al eliminar plantilla'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUseTemplate = (template: QuoteTemplate) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('quote-template-selected', JSON.stringify(template))
    }
    router.push(`/dashboard/quotes/new?template_id=${template.id}`)
  }

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return templates.filter((template) => {
      const matchesQuery =
        normalizedQuery === '' ||
        template.name.toLowerCase().includes(normalizedQuery) ||
        (template.description || '').toLowerCase().includes(normalizedQuery) ||
        template.material.toLowerCase().includes(normalizedQuery)

      const matchesMaterial = materialFilter === 'all' || template.material === materialFilter
      return matchesQuery && matchesMaterial
    })
  }, [templates, query, materialFilter])

  const stats = useMemo(() => {
    if (templates.length === 0) {
      return {
        total: 0,
        avgMarkup: 0,
        avgBaseCost: 0,
      }
    }

    const totalMarkup = templates.reduce((sum, template) => sum + template.markup_percentage, 0)
    const totalBaseCost = templates.reduce((sum, template) => sum + template.base_cost, 0)

    return {
      total: templates.length,
      avgMarkup: totalMarkup / templates.length,
      avgBaseCost: totalBaseCost / templates.length,
    }
  }, [templates])

  if (loading) {
    return <div className="p-8">Cargando plantillas...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 text-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Plantillas de Cotizacion</h1>
            <p className="text-white/80 mt-2">
              Reutiliza configuraciones de impresion y aplica reglas de precio en segundos.
            </p>
          </div>
          <button
            onClick={openCreateEditor}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            + Nueva Plantilla
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Plantillas" value={stats.total.toString()} />
        <StatCard label="Margen Promedio" value={`${stats.avgMarkup.toFixed(1)}%`} />
        <StatCard label="Costo Base Promedio" value={`$${stats.avgBaseCost.toFixed(2)}`} />
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, material o descripcion"
            className="px-3 py-2 border rounded-lg"
          />
          <select
            value={materialFilter}
            onChange={(event) => setMaterialFilter(event.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Todos los materiales</option>
            {MATERIAL_OPTIONS.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
          <div className="text-sm text-muted-foreground self-center">Mostrando: {filteredTemplates.length}</div>
        </div>
      </section>

      {(error || notice) && (
        <section className="space-y-2">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm">
              {notice}
            </div>
          )}
        </section>
      )}

      {editorOpen && (
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">{editingTemplateID ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
            <button onClick={resetEditor} className="text-sm text-muted-foreground hover:text-foreground">
              Cerrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Descripcion</label>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Material</label>
              <select
                value={formData.material}
                onChange={(event) => setFormData((prev) => ({ ...prev, material: event.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {MATERIAL_OPTIONS.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
            </div>

            <NumberInput
              label="Relleno (%)"
              value={formData.infill_percentage}
              onChange={(value) => setFormData((prev) => ({ ...prev, infill_percentage: value }))}
              min={0}
              max={100}
              step={5}
            />

            <NumberInput
              label="Altura de capa (mm)"
              value={formData.layer_height}
              onChange={(value) => setFormData((prev) => ({ ...prev, layer_height: value }))}
              min={0.05}
              max={0.6}
              step={0.05}
            />

            <NumberInput
              label="Velocidad (mm/s)"
              value={formData.print_speed}
              onChange={(value) => setFormData((prev) => ({ ...prev, print_speed: value }))}
              min={1}
              max={300}
              step={1}
            />

            <NumberInput
              label="Costo base (MXN)"
              value={formData.base_cost}
              onChange={(value) => setFormData((prev) => ({ ...prev, base_cost: value }))}
              min={0}
              step={0.01}
            />

            <NumberInput
              label="Margen (%)"
              value={formData.markup_percentage}
              onChange={(value) => setFormData((prev) => ({ ...prev, markup_percentage: value }))}
              min={0}
              max={400}
              step={1}
            />

            <div className="md:col-span-2 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Guardando...' : editingTemplateID ? 'Actualizar Plantilla' : 'Crear Plantilla'}
              </button>
              <button type="button" onClick={resetEditor} className="px-4 py-2 border rounded-lg hover:bg-accent">
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const recommendedUnitPrice = template.base_cost * (1 + template.markup_percentage / 100)

          return (
            <article
              key={template.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">{template.material}</p>
                </div>
                <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-1">
                  {new Date(template.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="text-sm mt-3 min-h-[2.5rem] text-muted-foreground">{template.description || 'Sin descripcion'}</p>

              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Spec label="Relleno" value={`${template.infill_percentage}%`} />
                <Spec label="Capa" value={`${template.layer_height}mm`} />
                <Spec label="Velocidad" value={`${template.print_speed}mm/s`} />
                <Spec label="Costo base" value={`$${template.base_cost.toFixed(2)}`} />
                <Spec label="Margen" value={`${template.markup_percentage}%`} />
                <Spec label="Precio sugerido" value={`$${recommendedUnitPrice.toFixed(2)}`} />
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                >
                  Usar en Cotizacion
                </button>
                <button
                  onClick={() => openEditEditor(template)}
                  className="px-3 py-2 rounded-lg border text-sm hover:bg-accent"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  disabled={submitting}
                  className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 rounded-xl border border-dashed text-muted-foreground">
          No hay plantillas con esos filtros.
        </div>
      )}
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between col-span-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </article>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Number.parseFloat(event.target.value) || 0)}
        className="w-full px-3 py-2 border rounded-lg"
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}
