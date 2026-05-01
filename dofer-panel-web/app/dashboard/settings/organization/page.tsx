'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock3,
  CreditCard,
  PackageCheck,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react'

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

interface OrganizationOverview {
  admins: number
  operators: number
  viewers: number
  active_orders: number
  delivered_orders: number
  urgent_orders: number
  overdue_production_orders: number
  unassigned_orders: number
  draft_quotes: number
  sent_quotes: number
  accepted_quotes: number
  expired_quotes: number
  available_printers: number
  busy_printers: number
  maintenance_printers: number
  offline_printers: number
  active_products: number
  inactive_products: number
  orders_last_30_days: number
  quotes_last_30_days: number
  customers_last_30_days: number
  payments_last_30_days: number
  order_value: number
  quote_value: number
  collected: number
  pending: number
  overdue: number
  collection_rate: number
  completion_rate: number
  quote_acceptance_rate: number
  last_order_at?: string
  last_payment_at?: string
  role_breakdown: OrganizationBreakdown[]
  order_status_breakdown: OrganizationBreakdown[]
  quote_status_breakdown: OrganizationBreakdown[]
  platform_breakdown: OrganizationBreakdown[]
}

interface OrganizationBreakdown {
  key: string
  count: number
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Lectura',
}

const orderStatusLabels: Record<string, string> = {
  new: 'Nuevas',
  printing: 'Impresion',
  post: 'Postproceso',
  packed: 'Empacadas',
  ready: 'Listas',
  delivered: 'Entregadas',
  cancelled: 'Canceladas',
}

const quoteStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviadas',
  accepted: 'Aceptadas',
  rejected: 'Rechazadas',
  expired: 'Expiradas',
}

const platformLabels: Record<string, string> = {
  tiktok: 'TikTok',
  shopify: 'Shopify',
  local: 'Local',
  other: 'Otro',
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

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null)
  const [overview, setOverview] = useState<OrganizationOverview | null>(null)
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
      const [organizationData, overviewData, organizationsData, auditData, metricsData] = await Promise.all([
        apiClient.get<OrganizationSummary>('/admin/organization'),
        apiClient.get<OrganizationOverview>('/admin/organization/overview'),
        apiClient.get<{ organizations: OrganizationSummary[] }>('/admin/organizations'),
        apiClient.get<{ logs: AuditLog[] }>('/admin/organization/audit', { params: { limit: 80 } }),
        apiClient.get<{ metrics: UserMetric[] }>('/admin/organization/user-metrics'),
      ])

      setOrganization(organizationData)
      setOverview(overviewData)
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

      {overview && (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <ControlCard
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Salud operativa"
              tone={overview.overdue_production_orders > 0 || overview.urgent_orders > 0 ? 'warning' : 'good'}
              items={[
                { label: 'Activas', value: overview.active_orders },
                { label: 'Urgentes', value: overview.urgent_orders },
                { label: 'Vencidas produccion', value: overview.overdue_production_orders },
                { label: 'Sin asignar', value: overview.unassigned_orders },
              ]}
            />
            <ControlCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Cobranza"
              tone={overview.overdue > 0 ? 'danger' : overview.pending > 0 ? 'warning' : 'good'}
              items={[
                { label: 'Cobrado', value: currency.format(overview.collected) },
                { label: 'Por cobrar', value: currency.format(overview.pending) },
                { label: 'Vencido', value: currency.format(overview.overdue) },
                { label: 'Tasa', value: `${overview.collection_rate.toFixed(1)}%` },
              ]}
            />
            <ControlCard
              icon={<Activity className="h-5 w-5" />}
              title="Ultimos 30 dias"
              tone="neutral"
              items={[
                { label: 'Ordenes', value: overview.orders_last_30_days },
                { label: 'Cotizaciones', value: overview.quotes_last_30_days },
                { label: 'Clientes', value: overview.customers_last_30_days },
                { label: 'Pagos', value: overview.payments_last_30_days },
              ]}
            />
            <ControlCard
              icon={<Printer className="h-5 w-5" />}
              title="Infraestructura"
              tone={overview.offline_printers > 0 || overview.maintenance_printers > 0 ? 'warning' : 'neutral'}
              items={[
                { label: 'Impresoras libres', value: overview.available_printers },
                { label: 'Ocupadas', value: overview.busy_printers },
                { label: 'Mantenimiento', value: overview.maintenance_printers },
                { label: 'Productos activos', value: overview.active_products },
              ]}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <PanelCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasa de completado</p>
                  <p className="mt-2 text-3xl font-semibold">{overview.completion_rate.toFixed(1)}%</p>
                </div>
                <PackageCheck className="h-5 w-5 text-emerald-600" />
              </div>
            </PanelCard>
            <PanelCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aceptacion de cotizaciones</p>
                  <p className="mt-2 text-3xl font-semibold">{overview.quote_acceptance_rate.toFixed(1)}%</p>
                </div>
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </PanelCard>
            <PanelCard>
              <div className="grid gap-3 text-sm">
                <InfoRow label="Ultima orden" value={overview.last_order_at ? formatDateTime(overview.last_order_at) : 'Sin ordenes'} />
                <InfoRow label="Ultimo pago" value={overview.last_payment_at ? formatDateTime(overview.last_payment_at) : 'Sin pagos'} />
              </div>
            </PanelCard>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <BreakdownCard title="Roles" data={overview.role_breakdown} labels={roleLabels} />
            <BreakdownCard title="Estados de ordenes" data={overview.order_status_breakdown} labels={orderStatusLabels} />
            <BreakdownCard title="Plataformas" data={overview.platform_breakdown} labels={platformLabels} />
            <BreakdownCard title="Cotizaciones" data={overview.quote_status_breakdown} labels={quoteStatusLabels} />
          </section>
        </>
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

function ControlCard({
  icon,
  title,
  tone,
  items,
}: {
  icon: ReactNode
  title: string
  tone: 'good' | 'warning' | 'danger' | 'neutral'
  items: Array<{ label: string; value: string | number }>
}) {
  const toneClasses: Record<typeof tone, string> = {
    good: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    neutral: 'text-primary bg-primary/10',
  }

  return (
    <PanelCard className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClasses[tone]}`}>
          {icon}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <InfoRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </PanelCard>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  )
}

function BreakdownCard({
  title,
  data,
  labels,
}: {
  title: string
  data: OrganizationBreakdown[]
  labels: Record<string, string>
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <PanelCard className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{total} registros</p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const percent = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{labels[item.key] || item.key}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(percent, 4)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PanelCard>
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
