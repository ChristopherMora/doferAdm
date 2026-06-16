'use client'

import { useCallback, useEffect, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateCommission } from '@/types'

type StatusFilter = 'pending' | 'paid' | ''

export default function AffiliateCommissionsPage() {
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<{ commissions: AffiliateCommission[] }>('/affiliate-commissions', {
        params: { status: statusFilter || undefined },
      })
      setCommissions(response.commissions || [])
      setSelectedCommissionIds([])
    } catch (error: unknown) {
      setApiError(`Error cargando comisiones: ${getErrorMessage(error, 'Error desconocido')}`)
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleMarkPaid = async (id: string) => {
    setProcessingId(id)
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-commissions/${id}/pay`, {})
      await load()
    } catch (error: unknown) {
      setApiError(`Error marcando comisión como pagada: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setProcessingId(null)
    }
  }

  const toggleCommission = (id: string) => {
    setSelectedCommissionIds((prev) => (
      prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]
    ))
  }

  const handleBatchPay = async () => {
    if (selectedCommissionIds.length === 0) return
    setProcessingId('batch')
    setApiError(null)
    try {
      await apiClient.patch('/affiliate-commissions/pay-batch', {
        commission_ids: selectedCommissionIds,
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
        payment_notes: paymentNotes || undefined,
      })
      setPaymentMethod('')
      setPaymentReference('')
      setPaymentNotes('')
      await load()
    } catch (error: unknown) {
      setApiError(`Error pagando lote: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setProcessingId(null)
    }
  }

  const totalPending = commissions.filter((c) => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0)
  const selectedTotal = commissions
    .filter((c) => selectedCommissionIds.includes(c.id))
    .reduce((sum, c) => sum + c.commission_amount, 0)

  if (loading) {
    return <LoadingState label="Cargando comisiones..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comisiones de afiliados"
        badge="Pagos"
        description="Lo que debes pagarle a cada afiliado por sus pedidos aprobados."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 rounded-xl bg-white/15 text-white border border-white/20"
          >
            <option value="pending">Pendientes</option>
            <option value="paid">Pagadas</option>
            <option value="">Todas</option>
          </select>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      {statusFilter !== 'paid' && (
        <div className="panel-surface rounded-xl p-4 space-y-3">
          <div>
            <div className="text-sm text-muted-foreground">Total pendiente por pagar</div>
            <div className="text-2xl font-bold text-yellow-600">${totalPending.toFixed(2)}</div>
          </div>
          {selectedCommissionIds.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Metodo de pago"
                className="px-3 py-2 border rounded-xl bg-background"
              />
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Referencia"
                className="px-3 py-2 border rounded-xl bg-background"
              />
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Notas"
                className="px-3 py-2 border rounded-xl bg-background"
              />
              <button
                onClick={handleBatchPay}
                disabled={processingId === 'batch'}
                className="px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60"
              >
                {processingId === 'batch'
                  ? 'Procesando...'
                  : `Pagar ${selectedCommissionIds.length} · $${selectedTotal.toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      )}

      <PanelCard>
        <div className="space-y-3">
          {commissions.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-background/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {c.status === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedCommissionIds.includes(c.id)}
                    onChange={() => toggleCommission(c.id)}
                    className="h-4 w-4"
                    aria-label="Seleccionar comision"
                  />
                )}
                <div>
                <p className="font-bold text-lg">${c.commission_amount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {c.status === 'paid' && c.paid_at ? `Pagada el ${new Date(c.paid_at).toLocaleDateString()}` : 'Pendiente de pago'}
                </p>
                {c.payment_reference && <p className="text-xs text-muted-foreground">Ref: {c.payment_reference}</p>}
                </div>
              </div>
              {c.status === 'pending' ? (
                <button
                  onClick={() => handleMarkPaid(c.id)}
                  disabled={processingId === c.id}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  {processingId === c.id ? 'Procesando...' : 'Marcar como pagada'}
                </button>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                  Pagada
                </span>
              )}
            </div>
          ))}

          {commissions.length === 0 && (
            <EmptyState title="No hay comisiones" description="Aparecerán aquí cuando apruebes pedidos de afiliados." />
          )}
        </div>
      </PanelCard>
    </div>
  )
}
