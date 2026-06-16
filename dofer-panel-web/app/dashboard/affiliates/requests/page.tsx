'use client'

import { useCallback, useEffect, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateOrderRequest } from '@/types'

type StatusFilter = 'pending' | 'approved' | 'rejected' | ''
type PriorityFilter = 'urgent' | 'normal' | 'low' | ''

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baja',
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-700',
}

export default function AffiliateRequestsPage() {
  const [requests, setRequests] = useState<AffiliateOrderRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<{ requests: AffiliateOrderRequest[] }>('/affiliate-requests', {
        params: { status: statusFilter || undefined, priority: priorityFilter || undefined },
      })
      setRequests(response.requests || [])
    } catch (error: unknown) {
      setApiError(`Error cargando solicitudes: ${getErrorMessage(error, 'Error desconocido')}`)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-requests/${id}/approve`)
      await load()
    } catch (error: unknown) {
      setApiError(`Error aprobando solicitud: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setProcessingId(null)
    }
  }

  const openReject = (id: string) => {
    setRejectingId(id)
    setRejectionReason('')
  }

  const confirmReject = async () => {
    if (!rejectingId) return
    setProcessingId(rejectingId)
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-requests/${rejectingId}/reject`, { rejection_reason: rejectionReason })
      setRejectingId(null)
      await load()
    } catch (error: unknown) {
      setApiError(`Error rechazando solicitud: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando solicitudes..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes de afiliados"
        badge="Revisión"
        description="Pedidos que los afiliados registraron para sus clientes, pendientes de tu aprobación antes de entrar a producción."
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 rounded-xl bg-white/15 text-white border border-white/20"
            >
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="">Todas</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="px-3 py-2 rounded-xl bg-white/15 text-white border border-white/20"
            >
              <option value="">Toda prioridad</option>
              <option value="urgent">Urgentes</option>
              <option value="normal">Normales</option>
              <option value="low">Bajas</option>
            </select>
          </div>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      <PanelCard>
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold">{req.product_name} × {req.quantity}</h3>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {req.customer_name}
                    {req.customer_phone ? ` · ${req.customer_phone}` : ''}
                  </p>
                  {req.customer_notes && <p className="text-sm text-muted-foreground">Notas: {req.customer_notes}</p>}
                  <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.normal}`}>
                    Prioridad {PRIORITY_LABELS[req.priority] || req.priority}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${req.final_price.toFixed(2)}</p>
                  {req.suggested_price_snapshot ? (
                    <p className="text-xs text-muted-foreground">Sugerido: ${req.suggested_price_snapshot.toFixed(2)}</p>
                  ) : null}
                  {req.min_price_snapshot ? (
                    <p className="text-xs text-muted-foreground">Minimo: ${req.min_price_snapshot.toFixed(2)}</p>
                  ) : null}
                </div>
              </div>

              {req.reference_images && req.reference_images.length > 0 && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {req.reference_images.map((image, index) => (
                    <a
                      key={`${req.id}-${index}`}
                      href={image}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-lg border bg-cover bg-center hover:ring-2 hover:ring-primary"
                      style={{ backgroundImage: `url(${image})` }}
                      aria-label={`Abrir referencia ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              {req.status === 'pending' ? (
                rejectingId === req.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Motivo del rechazo"
                      className="flex-1 min-w-[200px] px-3 py-2 border rounded-xl bg-background"
                    />
                    <button
                      onClick={confirmReject}
                      disabled={processingId === req.id || !rejectionReason.trim()}
                      className="px-3 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-60"
                    >
                      Confirmar rechazo
                    </button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-2 border rounded-xl hover:bg-accent">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={processingId === req.id}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                    >
                      {processingId === req.id ? 'Procesando...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => openReject(req.id)}
                      disabled={processingId === req.id}
                      className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Rechazar
                    </button>
                  </div>
                )
              ) : (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {req.status === 'approved' ? 'Aprobada' : `Rechazada: ${req.rejection_reason || ''}`}
                </span>
              )}
            </div>
          ))}

          {requests.length === 0 && (
            <EmptyState title="No hay solicitudes" description="Cuando un afiliado registre un pedido, aparecerá aquí para tu revisión." />
          )}
        </div>
      </PanelCard>
    </div>
  )
}
