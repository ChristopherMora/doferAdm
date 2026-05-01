'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock3,
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
import TableShell from '@/components/dashboard/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

type Role = 'admin' | 'operator' | 'viewer'
type RoleFilter = Role | 'all'
type AccountFilter = 'all' | 'active' | 'pending'

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

export default function UsersSettingsPage() {
  const [members, setMembers] = useState<OrganizationMember[]>([])
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

  const stats = useMemo(() => ({
    total: members.length,
    admins: members.filter((member) => member.organization_role === 'admin').length,
    operators: members.filter((member) => member.organization_role === 'operator').length,
    viewers: members.filter((member) => member.organization_role === 'viewer').length,
    pending: members.filter((member) => !member.auth_linked).length,
    activeWork: members.reduce((sum, member) => sum + member.active_orders, 0),
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
      const response = await apiClient.get<{ members: OrganizationMember[] }>('/auth/organization/members')
      setMembers((response.members || []).map(normalizeMember))
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudieron cargar los usuarios'))
      setMembers([])
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
        description="Miembros, roles, estado de cuenta y carga operativa del workspace activo."
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
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {apiError}
        </div>
      )}

      {apiNotice && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {apiNotice}
        </div>
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
        <form onSubmit={handleInviteMember} className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_180px_auto]">
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="correo@empresa.com"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <input
            type="text"
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="Nombre"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as Role)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            title={roleDescriptions[inviteRole]}
          >
            <option value="admin">Administrador</option>
            <option value="operator">Operador</option>
            <option value="viewer">Lectura</option>
          </select>
          <Button type="submit" disabled={savingUserID === 'invite'}>
            <UserPlus className="h-4 w-4" />
            Agregar
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Metric label="Usuarios" value={stats.total} icon={<Users className="h-4 w-4" />} />
        <Metric label="Admins" value={stats.admins} icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />} tone="emerald" />
        <Metric label="Operadores" value={stats.operators} icon={<UserCog className="h-4 w-4 text-blue-600" />} tone="blue" />
        <Metric label="Pendientes" value={stats.pending} icon={<Mail className="h-4 w-4 text-amber-600" />} tone="amber" />
        <Metric label="Ordenes activas" value={stats.activeWork} icon={<Clock3 className="h-4 w-4 text-primary" />} />
      </div>

      <PanelCard>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar usuario"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="operator">Operadores</option>
            <option value="viewer">Lectura</option>
          </select>
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todas las cuentas</option>
            <option value="active">Activas</option>
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
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {(['admin', 'operator', 'viewer'] as Role[]).map((role) => (
          <PanelCard key={role} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className={roleBadgeClass[role]}>
                {roleLabels[role]}
              </Badge>
              <span className="text-2xl font-semibold">
                {members.filter((member) => member.organization_role === role).length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
          </PanelCard>
        ))}
      </div>

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No hay miembros que coincidan con los filtros actuales."
          icon={<Users className="h-5 w-5" />}
        />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/35">
                <th className="min-w-[260px] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Carga</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground xl:table-cell">Actividad</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.user_id} className="border-b last:border-0">
                  <td className="px-4 py-4 align-top">
                    {editingUserID === member.user_id ? (
                      <form onSubmit={(event) => void handleProfileUpdate(event, member)} className="flex max-w-md gap-2">
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                          required
                        />
                        <Button type="submit" size="icon" disabled={savingUserID === member.user_id} title="Guardar nombre">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={cancelEditing} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{member.full_name || member.email}</span>
                            {member.is_current_user && <Badge variant="secondary">Tu</Badge>}
                            {member.is_last_admin && (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Ultimo admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={member.auth_linked
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                            }
                          >
                            {member.auth_linked ? 'Cuenta activa' : 'Pendiente'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Alta {formatDate(member.membership_created_at)}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="grid gap-2">
                      <Badge variant="outline" className={roleBadgeClass[member.organization_role]}>
                        {roleLabels[member.organization_role]}
                      </Badge>
                      <select
                        value={member.organization_role}
                        disabled={savingUserID === member.user_id || !member.can_change_role}
                        onChange={(event) => void handleRoleChange(member, event.target.value as Role)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        title={member.can_change_role ? roleDescriptions[member.organization_role] : 'Protegido para conservar un administrador'}
                        aria-label={`Cambiar rol de ${member.email}`}
                      >
                        <option value="admin">Administrador</option>
                        <option value="operator">Operador</option>
                        <option value="viewer">Lectura</option>
                      </select>
                    </div>
                  </td>
                  <td className="hidden px-4 py-4 text-right align-top lg:table-cell">
                    <div className="font-semibold">{member.active_orders} activas</div>
                    <div className="text-xs text-muted-foreground">{member.delivered_orders} entregadas</div>
                    <div className="text-xs text-muted-foreground">{formatMinutes(member.total_minutes)}</div>
                  </td>
                  <td className="hidden px-4 py-4 align-top text-muted-foreground xl:table-cell">
                    <div>{member.last_activity_at ? formatDateTime(member.last_activity_at) : 'Sin actividad'}</div>
                    <div className="text-xs">Actualizado {formatDate(member.membership_updated_at)}</div>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={savingUserID === member.user_id}
                        onClick={() => startEditing(member)}
                        title={`Editar nombre de ${member.email}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={savingUserID === member.user_id || !member.can_remove}
                        onClick={() => void handleRemoveMember(member)}
                        title={member.can_remove ? `Quitar acceso a ${member.email}` : 'Acceso protegido'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      {currentMember && (
        <PanelCard className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{currentMember.full_name || currentMember.email}</p>
              <p className="text-sm text-muted-foreground">{roleLabels[currentMember.organization_role]} en esta organizacion</p>
            </div>
          </div>
          <Badge variant="outline" className={currentMember.auth_linked ? roleBadgeClass.admin : 'border-amber-200 bg-amber-50 text-amber-700'}>
            {currentMember.auth_linked ? 'Sesion vinculada' : 'Sesion local'}
          </Badge>
        </PanelCard>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: ReactNode
  tone?: 'default' | 'emerald' | 'blue' | 'amber'
}) {
  const valueClass = {
    default: '',
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
  }[tone]

  return (
    <PanelCard className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`text-3xl font-semibold ${valueClass}`}>{value}</p>
    </PanelCard>
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

function formatDate(value?: string) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-MX', {
    dateStyle: 'medium',
  })
}

function formatDateTime(value?: string) {
  if (!value) return 'Sin actividad'
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
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
