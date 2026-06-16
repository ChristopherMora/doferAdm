'use client'

import { useCallback, useEffect, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateCommission } from '@/types'

interface MyCommissionsResponse {
  commissions: AffiliateCommission[]
  total_pending: number
  total_paid: number
}

export default function MyAffiliateCommissionsPage() {
  const [data, setData] = useState<MyCommissionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<MyCommissionsResponse>('/affiliates/me/commissions')
      setData(response)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando tus comisiones'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <LoadingState label="Cargando tus comisiones..." />
  }

  const commissions = data?.commissions || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis comisiones"
        badge="Afiliado"
        description="Lo que DOFER te debe pagar por tus pedidos aprobados."
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel-surface rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Pendiente por cobrar</div>
          <div className="text-2xl font-bold text-yellow-600">${(data?.total_pending || 0).toFixed(2)}</div>
        </div>
        <div className="panel-surface rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Ya pagado</div>
          <div className="text-2xl font-bold text-green-600">${(data?.total_paid || 0).toFixed(2)}</div>
        </div>
      </div>

      <PanelCard>
        <div className="space-y-3">
          {commissions.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-background/70 p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">${c.commission_amount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {c.status === 'paid' && c.paid_at ? `Pagada el ${new Date(c.paid_at).toLocaleDateString()}` : 'Pendiente de pago'}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                  c.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {c.status === 'paid' ? 'Pagada' : 'Pendiente'}
              </span>
            </div>
          ))}

          {commissions.length === 0 && (
            <EmptyState title="Aún no tienes comisiones" description="Aparecerán aquí cuando DOFER apruebe tus pedidos." />
          )}
        </div>
      </PanelCard>
    </div>
  )
}
