'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImageIcon } from 'lucide-react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateOrderRequest } from '@/types'

type StatusFilter = 'pending' | 'needs_changes' | 'approved' | 'rejected' | 'cancelled' | ''
type PriorityFilter = 'urgent' | 'normal' | 'low' | ''
type PaymentFilter = 'unpaid' | 'deposit' | 'paid' | ''
type DeliveryFilter = 'pickup' | 'local_delivery' | 'shipping' | ''

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
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('')
  const [lateOnly, setLateOnly] = useState(false)
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

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesPayment = paymentFilter === '' || request.customer_payment_status === paymentFilter
      const matchesDelivery = deliveryFilter === '' || request.delivery_method === deliveryFilter
      const matchesLate = !lateOnly || isLate(request)
      return matchesPayment && matchesDelivery && matchesLate
    })
  }, [deliveryFilter, lateOnly, paymentFilter, requests])

  const summary = useMemo(() => ({
    total: visibleRequests.length,
    unpaid: visibleRequests.filter((request) => request.customer_payment_status !== 'paid').length,
    late: visibleRequests.filter(isLate).length,
    urgent: visibleRequests.filter((request) => request.priority === 'urgent').length,
  }), [visibleRequests])

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
              <option value="needs_changes">Con cambios solicitados</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="cancelled">Canceladas</option>
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
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="px-3 py-2 rounded-xl bg-white/15 text-white border border-white/20"
            >
              <option value="">Todo pago</option>
              <option value="unpaid">Sin pago</option>
              <option value="deposit">Anticipo</option>
              <option value="paid">Pagado</option>
            </select>
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as DeliveryFilter)}
              className="px-3 py-2 rounded-xl bg-white/15 text-white border border-white/20"
            >
              <option value="">Toda entrega</option>
              <option value="pickup">Recoge</option>
              <option value="local_delivery">Local</option>
              <option value="shipping">Envío</option>
            </select>
            <button
              type="button"
              onClick={() => setLateOnly((prev) => !prev)}
              className={`rounded-xl border border-white/20 px-3 py-2 text-sm text-white ${lateOnly ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'}`}
            >
              Atrasados
            </button>
          </div>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Resultado" value={summary.total} />
        <Metric label="Con saldo" value={summary.unpaid} tone="yellow" />
        <Metric label="Atrasados" value={summary.late} tone="red" />
        <Metric label="Urgentes" value={summary.urgent} tone="blue" />
      </section>

      <PanelCard>
        <div className="space-y-3">
          {visibleRequests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                <RequestMediaPreview request={req} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{req.product_name} × {req.quantity}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.normal}`}>
                      Prioridad {PRIORITY_LABELS[req.priority] || req.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{req.customer_notes || 'Sin notas adicionales.'}</p>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <QuickFact label="Cliente" value={req.customer_name} />
                    <QuickFact label="Teléfono" value={req.customer_phone || 'Sin teléfono'} />
                    <QuickFact label="Email" value={req.customer_email || 'Sin email'} />
                    <QuickFact label="Pedido" value={req.id.slice(0, 8).toUpperCase()} />
                    <QuickFact label="Final" value={`$${req.final_price.toFixed(2)}`} strong />
                    <QuickFact
                      label="Sugerido"
                      value={req.suggested_price_snapshot ? `$${req.suggested_price_snapshot.toFixed(2)}` : 'Sin sugerido'}
                    />
                    <QuickFact
                      label="Mínimo"
                      value={req.min_price_snapshot ? `$${req.min_price_snapshot.toFixed(2)}` : 'Sin mínimo'}
                    />
                    <QuickFact
                      label="Referencias"
                      value={`${req.reference_images?.length || 0} imagen${(req.reference_images?.length || 0) === 1 ? '' : 'es'}`}
                    />
                    <QuickFact label="Pago" value={paymentLabel(req)} strong={req.customer_payment_status === 'paid'} />
                    <QuickFact label="Saldo" value={`$${Math.max(0, req.final_price - (req.customer_amount_paid || 0)).toFixed(2)}`} />
                    <QuickFact label="Entrega" value={deliveryLabel(req.delivery_method)} />
                    <QuickFact label="Prometido" value={promisedDateLabel(req.promised_delivery_date)} strong={isLate(req)} />
                  </div>
                </div>

                <div className="text-left lg:text-right">
                  <p className="font-bold text-lg">${req.final_price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/affiliates/requests/${req.id}`}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-accent"
                >
                  Ver detalle
                </Link>
              </div>

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
                <StatusBadge request={req} />
              )}
            </div>
          ))}

          {visibleRequests.length === 0 && (
            <EmptyState title="No hay solicitudes" description="Cuando un afiliado registre un pedido, aparecerá aquí para tu revisión." />
          )}
        </div>
      </PanelCard>
    </div>
  )
}

function StatusBadge({ request }: { request: AffiliateOrderRequest }) {
  const styles: Record<AffiliateOrderRequest['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    needs_changes: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<AffiliateOrderRequest['status'], string> = {
    pending: 'Pendiente',
    needs_changes: `Cambios solicitados${request.requested_changes ? `: ${request.requested_changes}` : ''}`,
    approved: 'Aprobada',
    rejected: `Rechazada${request.rejection_reason ? `: ${request.rejection_reason}` : ''}`,
    cancelled: `Cancelada${request.cancelled_reason ? `: ${request.cancelled_reason}` : ''}`,
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${styles[request.status]}`}>
      {labels[request.status]}
    </span>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'yellow' | 'red' | 'blue' }) {
  const toneClass = {
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  }[tone || 'blue']

  return (
    <div className="rounded-xl border border-border/70 bg-background/85 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone ? toneClass : 'text-foreground'}`}>{value}</div>
    </div>
  )
}

function QuickFact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{value}</p>
    </div>
  )
}

function paymentLabel(request: AffiliateOrderRequest) {
  const labels: Record<string, string> = {
    unpaid: 'Sin pago',
    deposit: `Anticipo $${(request.customer_amount_paid || 0).toFixed(2)}`,
    paid: 'Pagado',
  }
  return labels[request.customer_payment_status] || request.customer_payment_status || 'Sin pago'
}

function deliveryLabel(value?: string) {
  const labels: Record<string, string> = {
    pickup: 'Recoge en DOFER',
    local_delivery: 'Entrega local',
    shipping: 'Envío',
  }
  return labels[value || ''] || 'Sin definir'
}

function promisedDateLabel(value?: string) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString()
}

function isLate(request: AffiliateOrderRequest) {
  if (!request.promised_delivery_date || ['approved', 'rejected', 'cancelled'].includes(request.status)) return false
  const promised = new Date(request.promised_delivery_date)
  promised.setHours(23, 59, 59, 999)
  return promised.getTime() < Date.now()
}

function RequestMediaPreview({ request }: { request: AffiliateOrderRequest }) {
  const images = request.reference_images || []
  const primaryImage = images[0]

  return (
    <div className="space-y-2">
      {primaryImage ? (
        <a
          href={primaryImage}
          target="_blank"
          rel="noreferrer"
          className="block aspect-[4/3] overflow-hidden rounded-xl border border-border bg-cover bg-center hover:ring-2 hover:ring-primary"
          style={{ backgroundImage: `url(${primaryImage})` }}
          aria-label="Abrir imagen principal de la solicitud"
        >
          <span className="sr-only">Imagen principal de la solicitud</span>
        </a>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
          <div className="text-center">
            <ImageIcon className="mx-auto h-7 w-7" />
            <p className="mt-2 text-xs font-medium">Sin imágenes</p>
          </div>
        </div>
      )}

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-1">
          {images.slice(1, 6).map((image, index) => (
            <a
              key={`${request.id}-thumb-${index}`}
              href={image}
              target="_blank"
              rel="noreferrer"
              className="aspect-square rounded-md border bg-cover bg-center hover:ring-2 hover:ring-primary"
              style={{ backgroundImage: `url(${image})` }}
              aria-label={`Abrir referencia ${index + 2}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
