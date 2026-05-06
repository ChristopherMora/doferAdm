'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Hourglass,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

type Role = 'admin' | 'operator' | 'viewer'
type RoleFilter = Role | 'all'
type AccountFilter = 'all' | 'active' | 'pending'
type AccessTone = 'good' | 'warning' | 'danger' | 'neutral'

interface OrganizationMember {
  user_id: string
  email: string
  full_name: string
  user_role: Role
  organization_id: string
  organization_role: Role
  membership_created_at: string
  membership_updated_at: string
  account_created_at: string
  account_updated_at: string
  last_activity_at?: string
  auth_linked: boolean
  is_current_user: boolean
  is_last_admin: boolean
  can_remove: boolean
  can_change_role: boolean
  assigned_orders: number
  active_orders: number
  delivered_orders: number
  total_minutes: number
}

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

interface MemberStats {
  total: number
  admins: number
  operators: number
  viewers: number
  pending: number
  activeAccounts: number
  activeWork: number
  deliveredWork: number
  assignedWork: number
  totalMinutes: number
}

const roles: Role[] = ['admin', 'operator', 'viewer']

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Lectura',
}

const roleDescriptions: Record<Role, string> = {
  admin: 'Acceso completo a configuracion, finanzas y usuarios.',
  operator: 'Gestion de ordenes, cotizaciones y operacion diaria.',
  viewer: 'Consulta del panel sin cambios administrativos.',
}

const roleBadgeClass: Record<Role, string> = {
  admin: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  operator: 'border-blue-200 bg-blue-50 text-blue-700',
  viewer: 'border-slate-200 bg-slate-50 text-slate-700',
}

const roleProgressClass: Record<Role, string> = {
  admin: 'bg-emerald-500',
  operator: 'bg-blue-500',
  viewer: 'bg-slate-500',
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

const dayInMs = 24 * 60 * 60 * 1000

export default function UsersSettingsPage() {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingUserID, setSavingUserID] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('operator')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all')
  const [editingUserID, setEditingUserID] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiNotice, setApiNotice] = useState<string | null>(null)

  const stats = useMemo<MemberStats>(() => ({
    total: members.length,
    admins: members.filter((member) => member.organization_role === 'admin').length,
    operators: members.filter((member) => member.organization_role === 'operator').length,
    viewers: members.filter((member) => member.organization_role === 'viewer').length,
    pending: members.filter((member) => !member.auth_linked).length,
    activeAccounts: members.filter((member) => member.auth_linked).length,
    activeWork: members.reduce((sum, member) => sum + member.active_orders, 0),
    deliveredWork: members.reduce((sum, member) => sum + member.delivered_orders, 0),
    assignedWork: members.reduce((sum, member) => sum + member.assigned_orders, 0),
    totalMinutes: members.reduce((sum, member) => sum + member.total_minutes, 0),
  }), [members])

  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return members.filter((member) => {
      const matchesSearch = !normalizedSearch ||
        member.email.toLowerCase().includes(normalizedSearch) ||
        (member.full_name || '').toLowerCase().includes(normalizedSearch)
      const matchesRole = roleFilter === 'all' || member.organization_role === roleFilter
      const matchesAccount =
        accountFilter === 'all' ||
        (accountFilter === 'active' && member.auth_linked) ||
        (accountFilter === 'pending' && !member.auth_linked)

      return matchesSearch && matchesRole && matchesAccount
    })
  }, [accountFilter, members, roleFilter, searchTerm])

  const currentMember = useMemo(
    () => members.find((member) => member.is_current_user),
    [members]
  )

  const loadMembers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [memberData, organizationData] = await Promise.all([
        apiClient.get<{ members: OrganizationMember[] }>('/auth/organization/members'),
        apiClient.get<OrganizationSummary>('/admin/organization'),
      ])

      setMembers((memberData.members || []).map(normalizeMember))
      setOrganization(normalizeOrganizationSummary(organizationData))
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudieron cargar los usuarios'))
      setMembers([])
      setOrganization(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const handleRoleChange = async (member: OrganizationMember, role: Role) => {
    if (member.organization_role === role || !member.can_change_role) return

    const previousMembers = members
    setMembers((current) => current.map((item) => (
      item.user_id === member.user_id
        ? { ...item, organization_role: role, user_role: role }
        : item
    )))
    setSavingUserID(member.user_id)
    setApiError(null)
    setApiNotice(null)

    try {
      await apiClient.patch(`/auth/organization/members/${member.user_id}/role`, { role })
      setApiNotice(`Rol actualizado para ${member.email}`)
      await loadMembers()
    } catch (error: unknown) {
      setMembers(previousMembers)
      setApiError(getErrorMessage(error, 'No se pudo actualizar el rol'))
    } finally {
      setSavingUserID(null)
    }
  }

  const handleInviteMember = async (event: FormEvent) => {
    event.preventDefault()
    setSavingUserID('invite')
    setApiError(null)
    setApiNotice(null)

    try {
      const response = await apiClient.post<{ invite_status?: string }>('/auth/organization/members', {
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
      })
      setInviteEmail('')
      setInviteName('')
      setInviteRole('operator')
      setShowInviteForm(false)
      setApiNotice(response.invite_status === 'sent'
        ? 'Invitacion enviada'
        : 'Miembro creado; queda pendiente de activar cuenta'
      )
      await loadMembers()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo invitar el usuario'))
    } finally {
      setSavingUserID(null)
    }
  }

  const startEditing = (member: OrganizationMember) => {
    setEditingUserID(member.user_id)
    setEditingName(member.full_name || member.email)
    setApiError(null)
    setApiNotice(null)
  }

  const cancelEditing = () => {
    setEditingUserID(null)
    setEditingName('')
  }

  const handleProfileUpdate = async (event: FormEvent, member: OrganizationMember) => {
    event.preventDefault()
    const nextName = editingName.trim()
    if (!nextName) return

    setSavingUserID(member.user_id)
    setApiError(null)
    setApiNotice(null)

    try {
      const response = await apiClient.patch<{ member: OrganizationMember }>(
        `/auth/organization/members/${member.user_id}`,
        { full_name: nextName }
      )
      const updatedMember = normalizeMember(response.member)
      setMembers((current) => current.map((item) => (
        item.user_id === member.user_id ? updatedMember : item
      )))
      setApiNotice(`Perfil actualizado para ${member.email}`)
      cancelEditing()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo actualizar el perfil'))
    } finally {
      setSavingUserID(null)
    }
  }

  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!member.can_remove) return

    const confirmed = window.confirm(`Quitar acceso a ${member.email}?`)
    if (!confirmed) return

    setSavingUserID(member.user_id)
    setApiError(null)
    setApiNotice(null)

    try {
      await apiClient.delete(`/auth/organization/members/${member.user_id}`)
      setApiNotice(`Acceso removido para ${member.email}`)
      await loadMembers()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo quitar el acceso'))
    } finally {
      setSavingUserID(null)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando usuarios..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        badge="Membresias"
        description="Control visual de accesos, roles, estado de cuenta y vigencia de la organizacion activa."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowInviteForm((current) => !current)}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <UserPlus className="h-4 w-4" />
              Invitar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadMembers(true)}
              disabled={refreshing}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </>
        }
      />

      {apiError && (
        <div className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {apiNotice && (
        <div className="flex gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{apiNotice}</span>
        </div>
      )}

      {organization && (
        <OrganizationAccessPanel
          organization={organization}
          stats={stats}
        />
      )}

      {stats.admins <= 1 && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Solo hay un administrador activo.</p>
            <p>Agrega otro administrador antes de hacer cambios de acceso criticos.</p>
          </div>
        </div>
      )}

      {showInviteForm && (
        <PanelCard>
          <form onSubmit={handleInviteMember} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionTitle icon={<UserPlus className="h-5 w-5" />} title="Nuevo acceso" />
              <Badge variant="outline" className={roleBadgeClass[inviteRole]}>
                {roleLabels[inviteRole]}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_190px_auto]">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="correo@empresa.com"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <input
                type="text"
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                placeholder="Nombre visible"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Role)}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                title={roleDescriptions[inviteRole]}
              >
                <option value="admin">Administrador</option>
                <option value="operator">Operador</option>
                <option value="viewer">Lectura</option>
              </select>
              <Button type="submit" disabled={savingUserID === 'invite'} className="h-11">
                <UserPlus className="h-4 w-4" />
                Agregar
              </Button>
            </div>
          </form>
        </PanelCard>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Con acceso"
          value={stats.activeAccounts}
          detail={`${stats.total} miembros`}
          icon={<KeyRound className="h-4 w-4" />}
          tone="good"
        />
        <Metric
          label="Admins"
          value={stats.admins}
          detail={stats.admins > 1 ? 'Respaldo cubierto' : 'Requiere respaldo'}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone={stats.admins > 1 ? 'good' : 'warning'}
        />
        <Metric
          label="Operadores"
          value={stats.operators}
          detail="Operacion diaria"
          icon={<UserCog className="h-4 w-4" />}
          tone="info"
        />
        <Metric
          label="Pendientes"
          value={stats.pending}
          detail={stats.pending === 0 ? 'Sin invitaciones' : 'Por activar'}
          icon={<Mail className="h-4 w-4" />}
          tone={stats.pending > 0 ? 'warning' : 'neutral'}
        />
        <Metric
          label="Carga activa"
          value={stats.activeWork}
          detail={`${stats.deliveredWork} entregadas`}
          icon={<Clock3 className="h-4 w-4" />}
          tone={stats.activeWork > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {roles.map((role) => (
          <RoleSummaryCard
            key={role}
            role={role}
            count={stats[role === 'admin' ? 'admins' : role === 'operator' ? 'operators' : 'viewers']}
            total={stats.total}
          />
        ))}
      </section>

      <PanelCard>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_190px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o correo"
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="operator">Operadores</option>
            <option value="viewer">Lectura</option>
          </select>
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todas las cuentas</option>
            <option value="active">Con acceso</option>
            <option value="pending">Pendientes</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchTerm('')
              setRoleFilter('all')
              setAccountFilter('all')
            }}
            className="h-11"
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </PanelCard>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle icon={<Users className="h-5 w-5" />} title="Mapa de acceso" />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{filteredMembers.length} visibles</Badge>
            <Badge variant="outline">{stats.activeAccounts} con acceso</Badge>
            {organization?.max_members ? (
              <Badge variant="outline">
                {stats.total}/{organization.max_members} cupos
              </Badge>
            ) : null}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="No hay miembros que coincidan con los filtros actuales."
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredMembers.map((member) => (
              <MemberAccessCard
                key={member.user_id}
                member={member}
                saving={savingUserID === member.user_id}
                isEditing={editingUserID === member.user_id}
                editingName={editingName}
                onEditingNameChange={setEditingName}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onSaveProfile={handleProfileUpdate}
                onRoleChange={handleRoleChange}
                onRemoveMember={handleRemoveMember}
              />
            ))}
          </div>
        )}
      </section>

      {currentMember && (
        <PanelCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{currentMember.full_name || currentMember.email}</p>
              <p className="text-sm text-muted-foreground">
                {roleLabels[currentMember.organization_role]} en esta organizacion
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={currentMember.auth_linked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
              {currentMember.auth_linked ? 'Sesion vinculada' : 'Sesion local'}
            </Badge>
            <Badge variant="outline">
              {formatMemberTenure(currentMember.membership_created_at)}
            </Badge>
          </div>
        </PanelCard>
      )}
    </div>
  )
}

function OrganizationAccessPanel({
  organization,
  stats,
}: {
  organization: OrganizationSummary
  stats: MemberStats
}) {
  const tone = getOrganizationAccessTone(organization)
  const daysRemaining = getOrganizationDaysRemaining(organization)
  const membershipProgress = getMembershipProgress(organization.subscription_starts_at, organization.subscription_ends_at)
  const maxMembers = organization.max_members || 0
  const memberUsage = maxMembers > 0 ? Math.min(100, (stats.total / maxMembers) * 100) : 0

  return (
    <section className={`overflow-hidden rounded-xl border p-5 shadow-sm md:p-6 ${accessPanelClass(tone)}`}>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${accessIconClass(tone)}`}>
                {organization.is_access_blocked ? <Lock className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
              </span>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={subscriptionStatusClass(organization.subscription_status, organization.is_access_blocked)}>
                    {subscriptionStatusLabels[organization.subscription_status] || organization.subscription_status}
                  </Badge>
                  <Badge variant="outline">
                    {subscriptionPlanLabels[organization.subscription_plan] || organization.subscription_plan}
                  </Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold">{organization.name}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {organization.access_message || 'Acceso operativo activo para esta organizacion.'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/80 px-4 py-3 text-left md:min-w-44 md:text-right">
              <p className="text-xs font-medium uppercase text-muted-foreground">Membresia restante</p>
              <p className={`mt-1 text-3xl font-semibold ${daysRemainingToneClass(daysRemaining)}`}>
                {formatDaysRemaining(daysRemaining)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AccessDatum
              icon={<CalendarClock className="h-4 w-4" />}
              label="Pagado hasta"
              value={organization.subscription_ends_at ? formatDate(organization.subscription_ends_at) : 'Sin vencimiento'}
              detail={organization.grace_ends_at ? `Gracia ${formatDate(organization.grace_ends_at)}` : 'Sin periodo de gracia'}
            />
            <AccessDatum
              icon={<KeyRound className="h-4 w-4" />}
              label="Accesos activos"
              value={`${stats.activeAccounts}/${stats.total}`}
              detail={stats.pending > 0 ? `${stats.pending} pendientes` : 'Todos activados'}
            />
            <AccessDatum
              icon={<Users className="h-4 w-4" />}
              label="Cupos"
              value={maxMembers > 0 ? `${stats.total}/${maxMembers}` : `${stats.total}`}
              detail={maxMembers > 0 ? `${Math.round(memberUsage)}% usado` : 'Sin limite configurado'}
            />
            <AccessDatum
              icon={<Clock3 className="h-4 w-4" />}
              label="Trabajo activo"
              value={stats.activeWork}
              detail={`${formatMinutes(stats.totalMinutes)} registrados`}
            />
          </div>

          {membershipProgress !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Periodo de membresia</span>
                <span>{Math.round(membershipProgress)}% usado</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/80">
                <div
                  className={`h-full rounded-full ${membershipProgressClass(tone)}`}
                  style={{ width: `${Math.max(4, membershipProgress)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-md ${accessIconClass(tone)}`}>
              {tone === 'danger' ? <Lock className="h-5 w-5" /> : tone === 'warning' ? <Hourglass className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="font-semibold">Acceso operativo</h3>
              <p className="text-xs text-muted-foreground">{organization.slug}</p>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <InfoRow label="Estado" value={subscriptionStatusLabels[organization.subscription_status] || organization.subscription_status} />
            <InfoRow label="Admins" value={stats.admins} />
            <InfoRow label="Ordenes / mes" value={organization.max_orders_per_month > 0 ? organization.max_orders_per_month : 'Sin limite'} />
            <InfoRow label="Actualizada" value={formatDate(organization.updated_at)} />
          </div>

          {organization.suspension_reason && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {organization.suspension_reason}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AccessDatum({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function MemberAccessCard({
  member,
  saving,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEditing,
  onCancelEditing,
  onSaveProfile,
  onRoleChange,
  onRemoveMember,
}: {
  member: OrganizationMember
  saving: boolean
  isEditing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onStartEditing: (member: OrganizationMember) => void
  onCancelEditing: () => void
  onSaveProfile: (event: FormEvent, member: OrganizationMember) => void | Promise<void>
  onRoleChange: (member: OrganizationMember, role: Role) => void | Promise<void>
  onRemoveMember: (member: OrganizationMember) => void | Promise<void>
}) {
  return (
    <article className="panel-surface rounded-xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${memberAvatarClass(member.organization_role)}`}>
            {memberInitials(member)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold">{member.full_name || member.email}</h3>
              {member.is_current_user && <Badge variant="secondary">Tu</Badge>}
              {member.is_last_admin && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  Ultimo admin
                </Badge>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={saving}
            onClick={() => onStartEditing(member)}
            title={`Editar nombre de ${member.email}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={saving || !member.can_remove}
            onClick={() => void onRemoveMember(member)}
            title={member.can_remove ? `Quitar acceso a ${member.email}` : 'Acceso protegido'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={(event) => void onSaveProfile(event, member)} className="mt-4 flex gap-2">
          <input
            value={editingName}
            onChange={(event) => onEditingNameChange(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            required
          />
          <Button type="submit" size="icon" disabled={saving} title="Guardar nombre">
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onCancelEditing} title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className={roleBadgeClass[member.organization_role]}>
          {roleLabels[member.organization_role]}
        </Badge>
        <Badge
          variant="outline"
          className={member.auth_linked
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
          }
        >
          {member.auth_linked ? 'Con acceso' : 'Pendiente'}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniInfo label="Alta" value={formatDate(member.membership_created_at)} detail={formatMemberTenure(member.membership_created_at)} />
        <MiniInfo label="Actividad" value={member.last_activity_at ? formatDate(member.last_activity_at) : 'Sin actividad'} detail={member.last_activity_at ? formatRelativeActivity(member.last_activity_at) : 'Sin registro'} />
      </div>

      <div className="mt-4 grid grid-cols-3 rounded-lg border border-border/70 bg-muted/35 p-3 text-center">
        <div>
          <p className="text-lg font-semibold">{member.active_orders}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </div>
        <div className="border-x border-border/70">
          <p className="text-lg font-semibold">{member.delivered_orders}</p>
          <p className="text-xs text-muted-foreground">Entregadas</p>
        </div>
        <div>
          <p className="text-lg font-semibold">{formatMinutes(member.total_minutes)}</p>
          <p className="text-xs text-muted-foreground">Tiempo</p>
        </div>
      </div>

      <label className="mt-4 grid gap-1.5">
        <span className="text-xs font-medium uppercase text-muted-foreground">Permiso en la organizacion</span>
        <select
          value={member.organization_role}
          disabled={saving || !member.can_change_role}
          onChange={(event) => void onRoleChange(member, event.target.value as Role)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          title={member.can_change_role ? roleDescriptions[member.organization_role] : 'Protegido para conservar un administrador'}
          aria-label={`Cambiar rol de ${member.email}`}
        >
          <option value="admin">Administrador</option>
          <option value="operator">Operador</option>
          <option value="viewer">Lectura</option>
        </select>
      </label>
    </article>
  )
}

function MiniInfo({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function RoleSummaryCard({
  role,
  count,
  total,
}: {
  role: Role
  count: number
  total: number
}) {
  const percent = total > 0 ? (count / total) * 100 : 0

  return (
    <PanelCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className={roleBadgeClass[role]}>
          {roleLabels[role]}
        </Badge>
        <span className="text-2xl font-semibold">{count}</span>
      </div>
      <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${roleProgressClass[role]}`} style={{ width: `${Math.max(percent, count > 0 ? 6 : 0)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{Math.round(percent)}% del equipo</p>
      </div>
    </PanelCard>
  )
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  detail?: string
  icon: ReactNode
  tone?: 'neutral' | 'good' | 'info' | 'warning' | 'danger'
}) {
  const toneClasses = {
    neutral: 'bg-primary/10 text-primary',
    good: 'bg-emerald-50 text-emerald-600',
    info: 'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  }[tone]

  return (
    <PanelCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClasses}`}>{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-semibold">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  )
}

function getOrganizationAccessTone(organization: OrganizationSummary): AccessTone {
  const days = getOrganizationDaysRemaining(organization)

  if (organization.is_access_blocked || organization.subscription_status === 'suspended' || organization.subscription_status === 'cancelled') {
    return 'danger'
  }
  if (organization.subscription_status === 'past_due' || (days !== undefined && days <= 7)) {
    return 'warning'
  }
  if (organization.subscription_status === 'trialing') {
    return 'neutral'
  }
  return 'good'
}

function accessPanelClass(tone: AccessTone) {
  switch (tone) {
    case 'danger':
      return 'border-red-200 bg-red-50/85'
    case 'warning':
      return 'border-amber-200 bg-amber-50/85'
    case 'neutral':
      return 'border-blue-200 bg-blue-50/80'
    default:
      return 'border-emerald-200 bg-emerald-50/80'
  }
}

function accessIconClass(tone: AccessTone) {
  switch (tone) {
    case 'danger':
      return 'bg-red-100 text-red-700'
    case 'warning':
      return 'bg-amber-100 text-amber-700'
    case 'neutral':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-emerald-100 text-emerald-700'
  }
}

function membershipProgressClass(tone: AccessTone) {
  switch (tone) {
    case 'danger':
      return 'bg-red-500'
    case 'warning':
      return 'bg-amber-500'
    case 'neutral':
      return 'bg-blue-500'
    default:
      return 'bg-emerald-500'
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

function daysRemainingToneClass(days?: number) {
  if (days === undefined) return 'text-foreground'
  if (days < 0) return 'text-red-700'
  if (days <= 7) return 'text-amber-700'
  return 'text-emerald-700'
}

function getOrganizationDaysRemaining(organization: OrganizationSummary) {
  if (organization.days_until_access_change !== undefined && organization.days_until_access_change !== null) {
    return Number(organization.days_until_access_change)
  }
  return getDaysUntil(organization.grace_ends_at || organization.subscription_ends_at)
}

function formatDaysRemaining(days?: number) {
  if (days === undefined) return 'Sin vencimiento'
  if (days < 0) return `${Math.abs(days)} dias vencida`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

function getMembershipProgress(startsAt?: string, endsAt?: string) {
  if (!startsAt || !endsAt) return undefined
  const starts = new Date(startsAt).getTime()
  const ends = new Date(endsAt).getTime()
  const now = Date.now()

  if (Number.isNaN(starts) || Number.isNaN(ends) || ends <= starts) return undefined
  return Math.min(100, Math.max(0, ((now - starts) / (ends - starts)) * 100))
}

function getDaysUntil(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return Math.ceil((date.getTime() - Date.now()) / dayInMs)
}

function memberAvatarClass(role: Role) {
  switch (role) {
    case 'admin':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'operator':
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
  }
}

function memberInitials(member: OrganizationMember) {
  const name = (member.full_name || '').trim()
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
  }

  const emailName = member.email.split('@')[0] || member.email
  return emailName.slice(0, 2).toUpperCase()
}

function formatMemberTenure(value?: string) {
  const days = daysSince(value)
  if (days === undefined) return 'Sin alta'
  if (days === 0) return 'Alta hoy'
  if (days === 1) return '1 dia en org'
  return `${days} dias en org`
}

function formatRelativeActivity(value?: string) {
  const days = daysSince(value)
  if (days === undefined) return 'Sin registro'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} dias`
}

function daysSince(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / dayInMs))
}

function formatMinutes(minutes: number) {
  if (!minutes) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours} h`
  return `${hours} h ${remainingMinutes} min`
}

function formatDate(value?: string) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
  })
}

function normalizeMember(member: OrganizationMember): OrganizationMember {
  const organizationRole = member.organization_role || member.user_role || 'operator'
  const membershipCreatedAt = member.membership_created_at || new Date().toISOString()

  return {
    ...member,
    full_name: member.full_name || '',
    user_role: member.user_role || organizationRole,
    organization_role: organizationRole,
    membership_created_at: membershipCreatedAt,
    membership_updated_at: member.membership_updated_at || membershipCreatedAt,
    account_created_at: member.account_created_at || membershipCreatedAt,
    account_updated_at: member.account_updated_at || member.membership_updated_at || membershipCreatedAt,
    auth_linked: member.auth_linked ?? true,
    is_current_user: member.is_current_user ?? false,
    is_last_admin: member.is_last_admin ?? false,
    can_remove: member.can_remove ?? !member.is_current_user,
    can_change_role: member.can_change_role ?? true,
    assigned_orders: Number(member.assigned_orders || 0),
    active_orders: Number(member.active_orders || 0),
    delivered_orders: Number(member.delivered_orders || 0),
    total_minutes: Number(member.total_minutes || 0),
  }
}

function normalizeOrganizationSummary(organization: OrganizationSummary): OrganizationSummary {
  return {
    ...organization,
    members: Number(organization.members || 0),
    orders: Number(organization.orders || 0),
    quotes: Number(organization.quotes || 0),
    customers: Number(organization.customers || 0),
    products: Number(organization.products || 0),
    subscription_plan: organization.subscription_plan || 'professional',
    subscription_status: organization.subscription_status || 'active',
    suspension_reason: organization.suspension_reason || '',
    billing_notes: organization.billing_notes || '',
    max_members: Number(organization.max_members || 0),
    max_orders_per_month: Number(organization.max_orders_per_month || 0),
    is_access_blocked: Boolean(organization.is_access_blocked),
    access_message: organization.access_message || 'Acceso activo',
    created_at: organization.created_at || new Date().toISOString(),
    updated_at: organization.updated_at || new Date().toISOString(),
  }
}
