'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Activity, Building2, Clock3, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import TableShell from '@/components/dashboard/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient, getActiveOrganizationID, setActiveOrganizationID } from '@/lib/api'
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

interface AuditLog {
  id: string
  actor_user_id: string
  actor_email: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

interface UserMetric {
  user_id: string
  email: string
  full_name: string
  role: string
  assigned_orders: number
  delivered_orders: number
  active_orders: number
  total_minutes: number
  average_minutes: number
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Lectura',
}

const actionLabels: Record<string, string> = {
  'organization.updated': 'Organizacion actualizada',
  'organization_member.invited': 'Miembro invitado',
  'organization_member.role_updated': 'Rol actualizado',
  'organization_member.removed': 'Acceso removido',
  'order_payments.created': 'Pago de orden creado',
  'order_payments.deleted': 'Pago de orden eliminado',
  'quote_payments.created': 'Pago de cotizacion creado',
  'quote_payments.deleted': 'Pago de cotizacion eliminado',
}

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [userMetrics, setUserMetrics] = useState<UserMetric[]>([])
  const [activeOrganizationID, setActiveOrganizationIDState] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const loadOrganization = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [organizationData, organizationsData, auditData, metricsData] = await Promise.all([
        apiClient.get<OrganizationSummary>('/admin/organization'),
        apiClient.get<{ organizations: OrganizationSummary[] }>('/admin/organizations'),
        apiClient.get<{ logs: AuditLog[] }>('/admin/organization/audit', { params: { limit: 80 } }),
        apiClient.get<{ metrics: UserMetric[] }>('/admin/organization/user-metrics'),
      ])

      setOrganization(organizationData)
      setOrganizations(organizationsData.organizations || [])
      setAuditLogs(auditData.logs || [])
      setUserMetrics(metricsData.metrics || [])
      setName(organizationData.name)
      setSlug(organizationData.slug)
      setActiveOrganizationIDState(getActiveOrganizationID() || organizationData.id)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo cargar la organizacion'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setApiError(null)

    try {
      const updated = await apiClient.put<OrganizationSummary>('/admin/organization', { name, slug })
      setOrganization(updated)
      setName(updated.name)
      setSlug(updated.slug)
      void loadOrganization(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo guardar la organizacion'))
    } finally {
      setSaving(false)
    }
  }

  const handleOrganizationChange = (organizationID: string) => {
    setActiveOrganizationID(organizationID)
    setActiveOrganizationIDState(organizationID)
    window.location.reload()
  }

  if (loading) {
    return <LoadingState label="Cargando organizacion..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizacion"
        badge="Administracion"
        description="Control del workspace, actividad administrativa y rendimiento por usuario."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadOrganization(true)}
            disabled={refreshing}
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        }
      />

      {apiError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {apiError}
        </div>
      )}

      {organizations.length > 1 && (
        <PanelCard>
          <label className="grid gap-2 md:max-w-md">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organizacion activa</span>
            <select
              value={activeOrganizationID}
              onChange={(event) => handleOrganizationChange(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </PanelCard>
      )}

      {organization && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Metric label="Miembros" value={organization.members} icon={<Users className="h-4 w-4" />} />
          <Metric label="Ordenes" value={organization.orders} icon={<Building2 className="h-4 w-4" />} />
          <Metric label="Cotizaciones" value={organization.quotes} icon={<Activity className="h-4 w-4" />} />
          <Metric label="Clientes" value={organization.customers} icon={<Users className="h-4 w-4" />} />
          <Metric label="Productos" value={organization.products} icon={<ShieldCheck className="h-4 w-4" />} />
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

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-muted-foreground">ID: {organization?.id}</div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </form>
      </PanelCard>

      <section className="space-y-3">
        <SectionTitle icon={<Clock3 className="h-5 w-5" />} title="Metricas por usuario" />
        {userMetrics.length === 0 ? (
          <EmptyState title="Sin metricas de usuarios" description="Apareceran cuando haya ordenes asignadas o tiempos registrados." />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Asignadas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Entregadas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Activas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Tiempo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {userMetrics.map((metric) => (
                  <tr key={metric.user_id} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{metric.full_name || metric.email}</div>
                      <div className="text-xs text-muted-foreground">{metric.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">{roleLabels[metric.role] || metric.role}</Badge>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold">{metric.assigned_orders}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">{metric.delivered_orders}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-600">{metric.active_orders}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground">{formatMinutes(metric.total_minutes)}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground">{formatMinutes(Math.round(metric.average_minutes))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={<Activity className="h-5 w-5" />} title="Auditoria de cambios" />
        {auditLogs.length === 0 ? (
          <EmptyState title="Sin auditoria reciente" description="Los cambios de roles, organizacion y pagos quedaran registrados aqui." />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Cambio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Detalle</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{actionLabels[log.action] || log.action}</div>
                      <div className="text-xs text-muted-foreground">{log.entity_type}</div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{log.actor_email || 'Sistema'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatMetadata(log.metadata)}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <PanelCard className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-3xl font-semibold">{value}</p>
    </PanelCard>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  )
}

function formatMinutes(minutes: number) {
  if (!minutes) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours} h`
  return `${hours} h ${remainingMinutes} min`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata || {})
  if (entries.length === 0) return 'Sin detalle'

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ')
}
