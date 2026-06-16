'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate, AffiliateCommission, AffiliateOrderRequest, AffiliateStats } from '@/types'

export default function AffiliateDetailPage() {
  const params = useParams<{ id: string }>()
  const affiliateId = params.id

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [requests, setRequests] = useState<AffiliateOrderRequest[]>([])
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    display_name: '',
    phone: '',
    commission_type: 'percentage' as 'percentage' | 'fixed',
    commission_value: 0,
    max_pending_requests: 0,
    allow_urgent_orders: true,
    status: 'active' as 'active' | 'suspended',
    notes: '',
  })

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const [requestsRes, commissionsRes] = await Promise.all([
        apiClient.get<{ requests: AffiliateOrderRequest[] }>(`/affiliates/${affiliateId}/requests`),
        apiClient.get<{ commissions: AffiliateCommission[] }>(`/affiliates/${affiliateId}/commissions`),
      ])
      setRequests(requestsRes.requests || [])
      setCommissions(commissionsRes.commissions || [])
    } catch (error: unknown) {
      setApiError(`Error cargando actividad del afiliado: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setActivityLoading(false)
    }
  }, [affiliateId])

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const [affiliateRes, statsRes] = await Promise.all([
        apiClient.get<Affiliate>(`/affiliates/${affiliateId}`),
        apiClient.get<AffiliateStats>(`/affiliates/${affiliateId}/stats`),
      ])
      setAffiliate(affiliateRes)
      setStats(statsRes)
      setAccountEmail(affiliateRes.email)
      setEditForm({
        display_name: affiliateRes.display_name,
        phone: affiliateRes.phone || '',
        commission_type: affiliateRes.commission_type,
        commission_value: affiliateRes.commission_value,
        max_pending_requests: affiliateRes.max_pending_requests,
        allow_urgent_orders: affiliateRes.allow_urgent_orders,
        status: affiliateRes.status,
        notes: affiliateRes.notes || '',
      })
      void loadActivity()
    } catch (error: unknown) {
      setApiError(`Error cargando afiliado: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }, [affiliateId, loadActivity])

  useEffect(() => {
    if (affiliateId) void load()
  }, [affiliateId, load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setApiError(null)
    try {
      await apiClient.put(`/affiliates/${affiliateId}`, editForm)
      await load()
    } catch (error: unknown) {
      setApiError(`Error guardando cambios: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmail(true)
    setTemporaryPassword(null)
    setApiError(null)
    try {
      const response = await apiClient.patch<{ affiliate: Affiliate }>(`/affiliates/${affiliateId}/account/email`, {
        email: accountEmail,
      })
      setAffiliate(response.affiliate)
      setAccountEmail(response.affiliate.email)
    } catch (error: unknown) {
      setApiError(`Error actualizando correo: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSavingEmail(false)
    }
  }

  const handlePasswordReset = async () => {
    setResettingPassword(true)
    setTemporaryPassword(null)
    setApiError(null)
    try {
      const response = await apiClient.patch<{ temporary_password: string }>(`/affiliates/${affiliateId}/account/password`)
      setTemporaryPassword(response.temporary_password)
    } catch (error: unknown) {
      setApiError(`Error generando contraseña temporal: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setResettingPassword(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando afiliado..." />
  }

  if (!affiliate) {
    return <div className="p-6 text-sm text-muted-foreground">Afiliado no encontrado.</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={affiliate.display_name}
        badge="Afiliado"
        description={`${affiliate.email} · Codigo ${affiliate.referral_code}`}
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Solicitudes pendientes" value={stats.pending_requests} />
          <StatCard label="Pedidos aprobados" value={stats.approved_requests} />
          <StatCard label="Comisión pendiente" value={`$${stats.commission_pending.toFixed(2)}`} valueClass="text-yellow-600" />
          <StatCard label="Comisión pagada" value={`$${stats.commission_paid.toFixed(2)}`} valueClass="text-green-600" />
        </div>
      )}

      <PanelCard>
        <h2 className="text-xl font-bold mb-4">Acceso y recuperación</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form onSubmit={handleEmailSave} className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="Correo de acceso"
              className="px-3 py-2 border rounded-xl bg-background"
              required
            />
            <button
              type="submit"
              disabled={savingEmail || accountEmail.trim() === affiliate.email}
              className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
            >
              {savingEmail ? 'Guardando...' : 'Actualizar correo'}
            </button>
          </form>

          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resettingPassword}
            className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-accent disabled:opacity-60"
          >
            {resettingPassword ? 'Generando...' : 'Generar contraseña temporal'}
          </button>
        </div>

        {temporaryPassword && (
          <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            <p className="font-semibold">Comparte esta contraseña temporal de forma segura. No se mostrará de nuevo.</p>
            <p className="mt-1">Email: <code className="font-mono">{affiliate.email}</code></p>
            <p>Contraseña temporal: <code className="font-mono">{temporaryPassword}</code></p>
          </div>
        )}
      </PanelCard>

      <PanelCard>
        <h2 className="text-xl font-bold mb-4">Perfil y comisión</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={editForm.display_name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
            placeholder="Nombre"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <input
            type="text"
            value={editForm.phone}
            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Teléfono"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <select
            value={editForm.status}
            onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'suspended' }))}
            className="px-3 py-2 border rounded-xl bg-background"
          >
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
          <select
            value={editForm.commission_type}
            onChange={(e) => setEditForm((prev) => ({ ...prev, commission_type: e.target.value as 'percentage' | 'fixed' }))}
            className="px-3 py-2 border rounded-xl bg-background"
          >
            <option value="percentage">Comisión por porcentaje</option>
            <option value="fixed">Comisión fija por pedido</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={editForm.commission_value}
            onChange={(e) => setEditForm((prev) => ({ ...prev, commission_value: Number(e.target.value) }))}
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <input
            type="number"
            min={0}
            value={editForm.max_pending_requests}
            onChange={(e) => setEditForm((prev) => ({ ...prev, max_pending_requests: Number(e.target.value) }))}
            placeholder="Máx. solicitudes abiertas"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-xl bg-background text-sm">
            <input
              type="checkbox"
              checked={editForm.allow_urgent_orders}
              onChange={(e) => setEditForm((prev) => ({ ...prev, allow_urgent_orders: e.target.checked }))}
            />
            Permitir urgentes
          </label>
          <input
            type="text"
            value={editForm.notes}
            onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notas internas"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60 md:col-span-3"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard>
          <h2 className="text-xl font-bold mb-4">Solicitudes recientes</h2>
          <div className="space-y-2">
            {activityLoading && requests.length === 0 && (
              <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>
            )}
            {requests.map((req) => (
              <Link
                key={req.id}
                href={`/dashboard/affiliates/requests/${req.id}`}
                className="block rounded-lg border border-border/70 p-3 text-sm hover:bg-accent/50"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{req.product_name} × {req.quantity}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-muted-foreground">
                  {req.customer_name} · ${req.final_price.toFixed(2)} · {req.priority === 'urgent' ? 'Urgente' : req.priority === 'low' ? 'Baja' : 'Normal'}
                </p>
              </Link>
            ))}
            {!activityLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes todavía.</p>}
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-xl font-bold mb-4">Comisiones recientes</h2>
          <div className="space-y-2">
            {activityLoading && commissions.length === 0 && (
              <p className="text-sm text-muted-foreground">Cargando comisiones...</p>
            )}
            {commissions.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/70 p-3 text-sm flex justify-between">
                <span>${c.commission_amount.toFixed(2)}</span>
                <span className={c.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                  {c.status === 'paid' ? 'Pagada' : 'Pendiente'}
                </span>
              </div>
            ))}
            {!activityLoading && commissions.length === 0 && <p className="text-sm text-muted-foreground">Sin comisiones todavía.</p>}
          </div>
        </PanelCard>
      </div>
    </div>
  )
}

function StatCard({ label, value, valueClass }: { label: string; value: number | string; valueClass?: string }) {
  return (
    <div className="panel-surface rounded-xl p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${valueClass || ''}`}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    needs_changes: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    needs_changes: 'Pide cambios',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
