'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, PackagePlus, WalletCards } from 'lucide-react'

import LoadingState from '@/components/dashboard/LoadingState'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate, AffiliateOrderRequest, AffiliateStats } from '@/types'

export default function AffiliateHomePage() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [requests, setRequests] = useState<AffiliateOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const me = await apiClient.get<Affiliate>('/affiliates/me')
      setAffiliate(me)
      const [statsRes, requestsRes] = await Promise.all([
        apiClient.get<AffiliateStats>(`/affiliates/${me.id}/stats`).catch(() => null),
        apiClient.get<{ requests: AffiliateOrderRequest[] }>('/affiliates/me/requests').catch(() => ({ requests: [] })),
      ])
      setStats(statsRes)
      setRequests(requestsRes.requests || [])
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando tu perfil'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <LoadingState label="Cargando tu panel..." />
  }

  const attentionRequests = requests.filter((request) => request.status === 'needs_changes')

  return (
    <div className="space-y-6">
      <section className="panel-surface-strong rounded-2xl px-6 py-6 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 text-white">
        <p className="text-sm text-white/70">Hola,</p>
        <h1 className="mt-1 text-3xl font-bold">{affiliate?.display_name || 'Afiliado'}</h1>
        <p className="mt-2 text-white/80 max-w-xl">
          Registra los pedidos de tus clientes y dales seguimiento aquí. Cada pedido nuevo queda pendiente de
          revisión hasta que el equipo de DOFER lo aprueba.
        </p>
        {affiliate?.referral_code && (
          <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm">
            <span className="text-white/70">Codigo</span>
            <code className="font-mono font-semibold">{affiliate.referral_code}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(affiliate.referral_code)
                setCopiedCode(true)
                setTimeout(() => setCopiedCode(false), 1500)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 hover:bg-white/25"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedCode ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}
        {affiliate && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/75">
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
              {affiliate.max_pending_requests > 0 ? `${affiliate.max_pending_requests} pendientes máx.` : 'Sin límite de pendientes'}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
              {affiliate.allow_urgent_orders ? 'Urgentes permitidos' : 'Urgentes no disponibles'}
            </span>
          </div>
        )}
      </section>

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      {attentionRequests.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-semibold">Requieren atención</h2>
              <p className="text-sm text-orange-800">
                {attentionRequests.length} solicitud{attentionRequests.length === 1 ? '' : 'es'} con cambios solicitados.
              </p>
            </div>
            <Link href="/affiliate/orders" className="rounded-xl bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700">
              Revisar
            </Link>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {attentionRequests.slice(0, 3).map((request) => (
              <Link
                key={request.id}
                href={`/affiliate/orders/${request.id}`}
                className="rounded-lg border border-orange-200 bg-white/70 p-3 text-sm hover:bg-white"
              >
                <p className="font-medium">{request.product_name} × {request.quantity}</p>
                <p className="mt-1 line-clamp-2 text-orange-800">{request.requested_changes || 'Cambios pendientes de revisar.'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pendientes de revisión" value={stats.pending_requests} />
          <StatCard label="Aprobados" value={stats.approved_requests} />
          <StatCard label="Comisión pendiente" value={`$${stats.commission_pending.toFixed(2)}`} valueClass="text-yellow-600" />
          <StatCard label="Comisión pagada" value={`$${stats.commission_paid.toFixed(2)}`} valueClass="text-green-600" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/affiliate/orders/new" className="rounded-xl border border-border/70 bg-background/85 p-4 hover:bg-accent/50">
          <PackagePlus className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">Registrar pedido</p>
          <p className="mt-1 text-sm text-muted-foreground">Captura cliente, precio, prioridad e imagenes de referencia.</p>
        </Link>
        <Link href="/affiliate/orders" className="rounded-xl border border-border/70 bg-background/85 p-4 hover:bg-accent/50">
          <ExternalLink className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">Seguimiento</p>
          <p className="mt-1 text-sm text-muted-foreground">Revisa aprobacion, produccion y entregas en un solo lugar.</p>
        </Link>
        <Link href="/affiliate/commissions" className="rounded-xl border border-border/70 bg-background/85 p-4 hover:bg-accent/50">
          <WalletCards className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">Comisiones</p>
          <p className="mt-1 text-sm text-muted-foreground">Consulta lo pendiente por cobrar y los pagos recibidos.</p>
        </Link>
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
