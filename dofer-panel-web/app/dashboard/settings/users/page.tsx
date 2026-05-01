'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldCheck, Trash2, UserCog, UserPlus, Users } from 'lucide-react'

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

interface OrganizationMember {
  user_id: string
  email: string
  full_name: string
  user_role: Role
  organization_id: string
  organization_role: Role
  membership_created_at: string
}

const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Lectura',
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
  const [apiError, setApiError] = useState<string | null>(null)

  const stats = useMemo(() => ({
    total: members.length,
    admins: members.filter((member) => member.organization_role === 'admin').length,
    operators: members.filter((member) => member.organization_role === 'operator').length,
    viewers: members.filter((member) => member.organization_role === 'viewer').length,
  }), [members])

  const loadMembers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const response = await apiClient.get<{ members: OrganizationMember[] }>('/auth/organization/members')
      setMembers(response.members || [])
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
    if (member.organization_role === role) return

    const previousMembers = members
    setMembers((current) => current.map((item) => (
      item.user_id === member.user_id
        ? { ...item, organization_role: role, user_role: role }
        : item
    )))
    setSavingUserID(member.user_id)
    setApiError(null)

    try {
      await apiClient.patch(`/auth/organization/members/${member.user_id}/role`, { role })
      await loadMembers()
    } catch (error: unknown) {
      setMembers(previousMembers)
      setApiError(getErrorMessage(error, 'No se pudo actualizar el rol'))
    } finally {
      setSavingUserID(null)
    }
  }

  const handleInviteMember = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingUserID('invite')
    setApiError(null)

    try {
      await apiClient.post('/auth/organization/members', {
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
      })
      setInviteEmail('')
      setInviteName('')
      setInviteRole('operator')
      setShowInviteForm(false)
      await loadMembers()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo invitar el usuario'))
    } finally {
      setSavingUserID(null)
    }
  }

  const handleRemoveMember = async (member: OrganizationMember) => {
    const confirmed = window.confirm(`Quitar acceso a ${member.email}?`)
    if (!confirmed) return

    setSavingUserID(member.user_id)
    setApiError(null)

    try {
      await apiClient.delete(`/auth/organization/members/${member.user_id}`)
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
        badge="Administracion"
        description="Miembros y roles de la organizacion DOFER."
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <PanelCard className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Usuarios</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-semibold">{stats.total}</p>
        </PanelCard>
        <PanelCard className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Administradores</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-semibold text-emerald-600">{stats.admins}</p>
        </PanelCard>
        <PanelCard className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Operadores</span>
            <UserCog className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-3xl font-semibold text-blue-600">{stats.operators}</p>
        </PanelCard>
        <PanelCard className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Lectura</span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-3xl font-semibold text-slate-600">{stats.viewers}</p>
        </PanelCard>
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="No hay usuarios"
          description="La organizacion no tiene miembros registrados."
          icon={<Users className="h-5 w-5" />}
        />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/35">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Alta</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id} className="border-b last:border-0">
                  <td className="px-4 py-4">
                    <div className="font-medium">{member.email}</div>
                    <div className="text-xs text-muted-foreground">{member.full_name || 'Sin nombre'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="outline" className={roleBadgeClass[member.organization_role]}>
                      {roleLabels[member.organization_role]}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-4 text-muted-foreground md:table-cell">
                    {new Date(member.membership_created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <select
                        value={member.organization_role}
                        disabled={savingUserID === member.user_id}
                        onChange={(event) => void handleRoleChange(member, event.target.value as Role)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        aria-label={`Cambiar rol de ${member.email}`}
                      >
                        <option value="admin">Administrador</option>
                        <option value="operator">Operador</option>
                        <option value="viewer">Lectura</option>
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={savingUserID === member.user_id}
                        onClick={() => void handleRemoveMember(member)}
                        title={`Quitar acceso a ${member.email}`}
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
    </div>
  )
}
