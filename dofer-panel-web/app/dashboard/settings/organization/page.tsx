'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Lock,
  PackageCheck,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  UserPlus,
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
  subscription_plan: string
  subscription_status: string
  subscription_starts_at?: string
  subscription_ends_at?: string
  grace_ends_at?: string
  access_suspended_at?: string
  suspension_reason: string
  billing_notes: string
  max_members: number
  max_orders_per_month: number
  is_access_blocked: boolean
  access_message: string
  days_until_access_change?: number
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

interface OrganizationMember {
  user_id: string
  email: string
  full_name: string
  organization_role: string
  membership_created_at: string
  last_activity_at?: string
  auth_linked: boolean
  active_orders: number
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

const subscriptionPlanLabels: Record<string, string> = {
  trial: 'Prueba',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom: 'Personalizado',
  internal: 'Interno',
}

const subscriptionStatusLabels: Record<string, string> = {
  trialing: 'Prueba',
  active: 'Activa',
  past_due: 'Pago vencido',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
}

const actionLabels: Record<string, string> = {
  'organization.updated': 'Organizacion actualizada',
  'organization.subscription_updated': 'Membresia actualizada',
  'organization_member.invited': 'Miembro invitado',
  'organization_member.profile_updated': 'Perfil actualizado',
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
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [activeOrganizationID, setActiveOrganizationIDState] = useState('')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('professional')
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [subscriptionStartsAt, setSubscriptionStartsAt] = useState('')
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('')
  const [graceEndsAt, setGraceEndsAt] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [billingNotes, setBillingNotes] = useState('')
  const [maxMembers, setMaxMembers] = useState('0')
  const [maxOrdersPerMonth, setMaxOrdersPerMonth] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSubscription, setSavingSubscription] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiNotice, setApiNotice] = useState<string | null>(null)

  const syncSubscriptionForm = useCallback((nextOrganization: OrganizationSummary) => {
    setSubscriptionPlan(nextOrganization.subscription_plan)
    setSubscriptionStatus(nextOrganization.subscription_status)
    setSubscriptionStartsAt(toDateTimeLocal(nextOrganization.subscription_starts_at))
    setSubscriptionEndsAt(toDateTimeLocal(nextOrganization.subscription_ends_at))
    setGraceEndsAt(toDateTimeLocal(nextOrganization.grace_ends_at))
    setSuspensionReason(nextOrganization.suspension_reason || '')
    setBillingNotes(nextOrganization.billing_notes || '')
    setMaxMembers(String(nextOrganization.max_members || 0))
    setMaxOrdersPerMonth(String(nextOrganization.max_orders_per_month || 0))
  }, [])

  const loadOrganization = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [organizationData, overviewData, organizationsData, auditData, metricsData, membersData] = await Promise.all([
        apiClient.get<OrganizationSummary>('/admin/organization'),
        apiClient.get<OrganizationOverview>('/admin/organization/overview'),
        apiClient.get<{ organizations: OrganizationSummary[] }>('/admin/organizations'),
        apiClient.get<{ logs: AuditLog[] }>('/admin/organization/audit', { params: { limit: 80 } }),
        apiClient.get<{ metrics: UserMetric[] }>('/admin/organization/user-metrics'),
        apiClient.get<{ members: OrganizationMember[] }>('/auth/organization/members'),
      ])

      const nextOrganization = normalizeOrganizationSummary(organizationData)
      const nextOrganizations = (organizationsData.organizations || []).map(normalizeOrganizationSummary)

      setOrganization(nextOrganization)
      setOverview(overviewData)
      setOrganizations(nextOrganizations)
      setAuditLogs(auditData.logs || [])
      setUserMetrics(metricsData.metrics || [])
      setMembers((membersData.members || []).map(normalizeOrganizationMember))
      setName(nextOrganization.name)
      setSlug(nextOrganization.slug)
      syncSubscriptionForm(nextOrganization)
      setActiveOrganizationIDState(getActiveOrganizationID() || nextOrganization.id)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo cargar la organizacion'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [syncSubscriptionForm])

  useEffect(() => {
    void loadOrganization()
  }, [loadOrganization])

  const recentMembers = useMemo(() => (
    [...members]
      .sort((a, b) => new Date(b.membership_created_at).getTime() - new Date(a.membership_created_at).getTime())
      .slice(0, 5)
  ), [members])

  const pendingMembers = useMemo(
    () => members.filter((member) => !member.auth_linked),
    [members]
  )

  const actionItems = useMemo(() => {
    if (!overview) return []

    const items: Array<{
      title: string
      value: string | number
      href: string
      tone: 'danger' | 'warning' | 'neutral'
    }> = []

    if (overview.admins <= 1) {
      items.push({
        title: 'Administrador de respaldo',
        value: 'Falta',
        href: '/dashboard/settings/users',
        tone: 'warning',
      })
    }
    if (organization?.is_access_blocked) {
      items.push({
        title: 'Acceso bloqueado',
        value: subscriptionStatusLabels[organization.subscription_status] || organization.subscription_status,
        href: '/dashboard/settings/organization',
        tone: 'danger',
      })
    } else if (organization?.subscription_status === 'past_due') {
      items.push({
        title: 'Pago vencido',
        value: organization.days_until_access_change !== undefined ? `${organization.days_until_access_change} dias` : 'Revisar',
        href: '/dashboard/settings/organization',
        tone: 'warning',
      })
    } else if (
      organization?.days_until_access_change !== undefined &&
      organization.days_until_access_change <= 7
    ) {
      items.push({
        title: 'Membresia por vencer',
        value: `${organization.days_until_access_change} dias`,
        href: '/dashboard/settings/organization',
        tone: 'warning',
      })
    }
    if (pendingMembers.length > 0) {
      items.push({
        title: 'Invitaciones pendientes',
        value: pendingMembers.length,
        href: '/dashboard/settings/users',
        tone: 'warning',
      })
    }
    if (overview.unassigned_orders > 0) {
      items.push({
        title: 'Ordenes sin asignar',
        value: overview.unassigned_orders,
        href: '/dashboard/orders',
        tone: 'warning',
      })
    }
    if (overview.overdue > 0) {
      items.push({
        title: 'Cobranza vencida',
        value: currency.format(overview.overdue),
        href: '/dashboard/finance',
        tone: 'danger',
      })
    }
    if (overview.offline_printers > 0 || overview.maintenance_printers > 0) {
      items.push({
        title: 'Impresoras con atencion',
        value: overview.offline_printers + overview.maintenance_printers,
        href: '/dashboard/printers',
        tone: 'warning',
      })
    }

    return items
  }, [organization, overview, pendingMembers])

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

  const buildSubscriptionPayload = (overrides: Partial<Record<string, string | number | null>> = {}) => ({
    subscription_plan: subscriptionPlan,
    subscription_status: subscriptionStatus,
    subscription_starts_at: fromDateTimeLocal(subscriptionStartsAt),
    subscription_ends_at: fromDateTimeLocal(subscriptionEndsAt),
    grace_ends_at: fromDateTimeLocal(graceEndsAt),
    suspension_reason: suspensionReason,
    billing_notes: billingNotes,
    max_members: parseNonNegativeInt(maxMembers),
    max_orders_per_month: parseNonNegativeInt(maxOrdersPerMonth),
    ...overrides,
  })

  const saveSubscription = async (payload = buildSubscriptionPayload()) => {
    setSavingSubscription(true)
    setApiError(null)
    setApiNotice(null)

    try {
      const updated = normalizeOrganizationSummary(
        await apiClient.patch<OrganizationSummary>('/admin/organization/subscription', payload)
      )
      setOrganization(updated)
      syncSubscriptionForm(updated)
      setApiNotice('Membresia y acceso actualizados')
      void loadOrganization(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo guardar la membresia'))
    } finally {
      setSavingSubscription(false)
    }
  }

  const handleSubscriptionSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await saveSubscription()
  }

  const handleSuspendAccess = async () => {
    const reason = suspensionReason.trim() || 'Acceso suspendido por pago pendiente'
    setSubscriptionStatus('suspended')
    setSuspensionReason(reason)
    await saveSubscription(buildSubscriptionPayload({
      subscription_status: 'suspended',
      suspension_reason: reason,
    }))
  }

  const handleActivateAccess = async () => {
    setSubscriptionStatus('active')
    setSuspensionReason('')
    await saveSubscription(buildSubscriptionPayload({
      subscription_status: 'active',
      suspension_reason: '',
    }))
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

      {apiNotice && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {apiNotice}
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

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <PanelCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle icon={<AlertTriangle className="h-5 w-5" />} title="Centro de control" />
                <Link href="/dashboard/settings/users" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  Membresias
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {actionItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Sin alertas criticas en este momento.</span>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {actionItems.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      className={`group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors ${actionToneClass(item.tone)}`}
                    >
                      <div>
                        <p className="text-sm text-muted-foreground">{item.title}</p>
                        <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              )}
            </PanelCard>

            <PanelCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle icon={<UserPlus className="h-5 w-5" />} title="Miembros recientes" />
                <Badge variant="outline">{members.length} total</Badge>
              </div>

              {recentMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin miembros registrados.</p>
              ) : (
                <div className="space-y-3">
                  {recentMembers.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.full_name || member.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={member.auth_linked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                          {member.auth_linked ? roleLabels[member.organization_role] || member.organization_role : 'Pendiente'}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(member.membership_created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>
          </section>
        </>
      )}

      {organization && (
        <PanelCard>
          <form onSubmit={handleSubscriptionSubmit} className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-md ${organization.is_access_blocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {organization.is_access_blocked ? <Lock className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Membresia y acceso</h2>
                  <p className="text-sm text-muted-foreground">
                    Controla el periodo pagado, gracia y bloqueo operativo de esta organizacion.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className={subscriptionStatusClass(organization.subscription_status, organization.is_access_blocked)}>
                      {subscriptionStatusLabels[organization.subscription_status] || organization.subscription_status}
                    </Badge>
                    <Badge variant="outline">
                      {subscriptionPlanLabels[organization.subscription_plan] || organization.subscription_plan}
                    </Badge>
                    {organization.days_until_access_change !== undefined && (
                      <Badge variant="secondary">
                        {organization.days_until_access_change} dias
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 text-sm lg:min-w-72">
                <InfoRow label="Estado" value={organization.access_message || 'Acceso activo'} />
                <InfoRow label="Pagado hasta" value={organization.subscription_ends_at ? formatDateTime(organization.subscription_ends_at) : 'Sin vencimiento'} />
                <InfoRow label="Gracia" value={organization.grace_ends_at ? formatDateTime(organization.grace_ends_at) : 'Sin gracia'} />
              </div>
            </div>

            {organization.is_access_blocked && (
              <div className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                <Ban className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Uso operativo bloqueado.</p>
                  <p>Ordenes, cotizaciones, clientes, impresoras y productos responderan con pago requerido hasta reactivar la membresia.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan</span>
                <select
                  value={subscriptionPlan}
                  onChange={(event) => setSubscriptionPlan(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="trial">Prueba</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="custom">Personalizado</option>
                  <option value="internal">Interno</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</span>
                <select
                  value={subscriptionStatus}
                  onChange={(event) => setSubscriptionStatus(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="trialing">Prueba</option>
                  <option value="active">Activa</option>
                  <option value="past_due">Pago vencido</option>
                  <option value="suspended">Suspendida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inicio</span>
                <input
                  type="datetime-local"
                  value={subscriptionStartsAt}
                  onChange={(event) => setSubscriptionStartsAt(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagado hasta</span>
                <input
                  type="datetime-local"
                  value={subscriptionEndsAt}
                  onChange={(event) => setSubscriptionEndsAt(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gracia hasta</span>
                <input
                  type="datetime-local"
                  value={graceEndsAt}
                  onChange={(event) => setGraceEndsAt(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Max miembros</span>
                <input
                  type="number"
                  min="0"
                  value={maxMembers}
                  onChange={(event) => setMaxMembers(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordenes / mes</span>
                <input
                  type="number"
                  min="0"
                  value={maxOrdersPerMonth}
                  onChange={(event) => setMaxOrdersPerMonth(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo de suspension</span>
                <textarea
                  value={suspensionReason}
                  onChange={(event) => setSuspensionReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Pago pendiente, contrato vencido..."
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas internas</span>
                <textarea
                  value={billingNotes}
                  onChange={(event) => setBillingNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Contacto, condiciones, acuerdos..."
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
              <div className="text-xs text-muted-foreground">
                Los limites en 0 quedan sin tope. El bloqueo operativo se aplica en backend.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleActivateAccess()} disabled={savingSubscription}>
                  <CheckCircle2 className="h-4 w-4" />
                  Reactivar
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleSuspendAccess()} disabled={savingSubscription}>
                  <Ban className="h-4 w-4" />
                  Suspender
                </Button>
                <Button type="submit" disabled={savingSubscription}>
                  <Save className="h-4 w-4" />
                  Guardar membresia
                </Button>
              </div>
            </div>
          </form>
        </PanelCard>
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
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span>ID: {organization?.id}</span>
              {organization && (
                <span>Creada {formatDate(organization.created_at)} | Actualizada {formatDate(organization.updated_at)}</span>
              )}
            </div>
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

function actionToneClass(tone: 'danger' | 'warning' | 'neutral') {
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
    default:
      return 'border-border bg-background hover:bg-secondary'
  }
}

function subscriptionStatusClass(status: string, isBlocked: boolean) {
  if (isBlocked || status === 'suspended' || status === 'cancelled') {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (status === 'past_due') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (status === 'trialing') {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return parsed
}

function formatMinutes(minutes: number) {
  if (!minutes) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours} h`
  return `${hours} h ${remainingMinutes} min`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
  })
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

function normalizeOrganizationMember(member: OrganizationMember): OrganizationMember {
  return {
    ...member,
    full_name: member.full_name || '',
    organization_role: member.organization_role || 'operator',
    membership_created_at: member.membership_created_at || new Date().toISOString(),
    auth_linked: member.auth_linked ?? true,
    active_orders: Number(member.active_orders || 0),
  }
}

function normalizeOrganizationSummary(organization: OrganizationSummary): OrganizationSummary {
  return {
    ...organization,
    subscription_plan: organization.subscription_plan || 'professional',
    subscription_status: organization.subscription_status || 'active',
    suspension_reason: organization.suspension_reason || '',
    billing_notes: organization.billing_notes || '',
    max_members: Number(organization.max_members || 0),
    max_orders_per_month: Number(organization.max_orders_per_month || 0),
    is_access_blocked: Boolean(organization.is_access_blocked),
    access_message: organization.access_message || 'Acceso activo',
  }
}
