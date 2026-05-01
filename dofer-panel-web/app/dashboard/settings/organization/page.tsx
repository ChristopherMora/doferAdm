'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Save, Users } from 'lucide-react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface OrganizationSummary {
  id: string
  name: string
  slug: string
  members: number
  orders: number
  quotes: number
  customers: number
  products: number
  created_at: string
  updated_at: string
}

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const loadOrganization = useCallback(async () => {
    setApiError(null)

    try {
      const data = await apiClient.get<OrganizationSummary>('/admin/organization')
      setOrganization(data)
      setName(data.name)
      setSlug(data.slug)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo cargar la organizacion'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setApiError(null)

    try {
      const updated = await apiClient.put<OrganizationSummary>('/admin/organization', { name, slug })
      setOrganization(updated)
      setName(updated.name)
      setSlug(updated.slug)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo guardar la organizacion'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando organizacion..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizacion"
        badge="Administracion"
        description="Datos generales y alcance operativo de la organizacion actual."
      />

      {apiError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {apiError}
        </div>
      )}

      {organization && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Metric label="Miembros" value={organization.members} />
          <Metric label="Ordenes" value={organization.orders} />
          <Metric label="Cotizaciones" value={organization.quotes} />
          <Metric label="Clientes" value={organization.customers} />
          <Metric label="Productos" value={organization.products} />
        </div>
      )}

      <PanelCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Perfil de organizacion</h2>
              <p className="text-sm text-muted-foreground">Estos datos identifican el workspace activo.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </label>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
              ID: {organization?.id}
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </form>
      </PanelCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <PanelCard className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Users className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-semibold">{value}</p>
    </PanelCard>
  )
}
