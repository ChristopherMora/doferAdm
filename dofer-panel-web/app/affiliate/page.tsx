'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate, AffiliateStats } from '@/types'

export default function AffiliateHomePage() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const me = await apiClient.get<Affiliate>('/affiliates/me')
      setAffiliate(me)
      const statsRes = await apiClient.get<AffiliateStats>(`/affiliates/${me.id}/stats`).catch(() => null)
      setStats(statsRes)
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

  return (
    <div className="space-y-6">
      <section className="panel-surface-strong rounded-2xl px-6 py-6 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 text-white">
        <p className="text-sm text-white/70">Hola,</p>
        <h1 className="mt-1 text-3xl font-bold">{affiliate?.display_name || 'Afiliado'}</h1>
        <p className="mt-2 text-white/80 max-w-xl">
          Registra los pedidos de tus clientes y dales seguimiento aquí. Cada pedido nuevo queda pendiente de
          revisión hasta que el equipo de DOFER lo aprueba.
        </p>
      </section>

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pendientes de revisión" value={stats.pending_requests} />
          <StatCard label="Aprobados" value={stats.approved_requests} />
          <StatCard label="Comisión pendiente" value={`$${stats.commission_pending.toFixed(2)}`} valueClass="text-yellow-600" />
          <StatCard label="Comisión pagada" value={`$${stats.commission_paid.toFixed(2)}`} valueClass="text-green-600" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/affiliate/orders/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
          + Registrar nuevo pedido
        </Link>
        <Link href="/affiliate/orders" className="px-4 py-2 border rounded-xl hover:bg-accent">
          Ver mis pedidos
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
