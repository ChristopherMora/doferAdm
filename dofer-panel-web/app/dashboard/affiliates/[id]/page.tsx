'use client'

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
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    display_name: '',
    phone: '',
    commission_type: 'percentage' as 'percentage' | 'fixed',
    commission_value: 0,
    status: 'active' as 'active' | 'suspended',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const [affiliateRes, statsRes, requestsRes, commissionsRes] = await Promise.all([
        apiClient.get<Affiliate>(`/affiliates/${affiliateId}`),
        apiClient.get<AffiliateStats>(`/affiliates/${affiliateId}/stats`),
        apiClient.get<{ requests: AffiliateOrderRequest[] }>(`/affiliates/${affiliateId}/requests`),
        apiClient.get<{ commissions: AffiliateCommission[] }>(`/affiliates/${affiliateId}/commissions`),
      ])
      setAffiliate(affiliateRes)
      setStats(statsRes)
      setRequests(requestsRes.requests || [])
      setCommissions(commissionsRes.commissions || [])
      setEditForm({
        display_name: affiliateRes.display_name,
        phone: affiliateRes.phone || '',
        commission_type: affiliateRes.commission_type,
        commission_value: affiliateRes.commission_value,
        status: affiliateRes.status,
        notes: affiliateRes.notes || '',
      })
    } catch (error: unknown) {
      setApiError(`Error cargando afiliado: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }, [affiliateId])

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
        description={affiliate.email}
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
            {requests.map((req) => (
              <div key={req.id} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{req.product_name} × {req.quantity}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-muted-foreground">{req.customer_name} · ${req.final_price.toFixed(2)}</p>
              </div>
            ))}
            {requests.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes todavía.</p>}
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-xl font-bold mb-4">Comisiones recientes</h2>
          <div className="space-y-2">
            {commissions.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/70 p-3 text-sm flex justify-between">
                <span>${c.commission_amount.toFixed(2)}</span>
                <span className={c.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                  {c.status === 'paid' ? 'Pagada' : 'Pendiente'}
                </span>
              </div>
            ))}
            {commissions.length === 0 && <p className="text-sm text-muted-foreground">Sin comisiones todavía.</p>}
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
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
