'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, MessageSquare, PenLine, XCircle } from 'lucide-react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateOrderRequest, AffiliateOrderRequestDetail } from '@/types'

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baja',
}

export default function AdminAffiliateRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const requestID = params.id

  const [detail, setDetail] = useState<AffiliateOrderRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [internalOnly, setInternalOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<AffiliateOrderRequestDetail>(`/affiliate-requests/${requestID}/detail`)
      setDetail(response)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando solicitud'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [requestID])

  useEffect(() => {
    if (requestID) void load()
  }, [load, requestID])

  const handleApprove = async () => {
    setProcessing('approve')
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-requests/${requestID}/approve`)
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error aprobando solicitud'))
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    setProcessing('reject')
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-requests/${requestID}/reject`, { rejection_reason: rejectionReason })
      setRejectionReason('')
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error rechazando solicitud'))
    } finally {
      setProcessing(null)
    }
  }

  const handleRequestChanges = async () => {
    if (!changeReason.trim()) return
    setProcessing('changes')
    setApiError(null)
    try {
      await apiClient.patch(`/affiliate-requests/${requestID}/changes`, { reason: changeReason })
      setChangeReason('')
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error solicitando cambios'))
    } finally {
      setProcessing(null)
    }
  }

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!commentMessage.trim()) return
    setProcessing('comment')
    setApiError(null)
    try {
      await apiClient.post(`/affiliate-requests/${requestID}/comments`, {
        message: commentMessage,
        internal_only: internalOnly,
      })
      setCommentMessage('')
      setInternalOnly(false)
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error guardando comentario'))
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando solicitud..." />
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Solicitud" badge="Afiliados" />
        {apiError && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</div>}
      </div>
    )
  }

  const request = detail.request
  const canReview = request.status === 'pending' || request.status === 'needs_changes'
  const canRequestChanges = request.status === 'pending'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${request.product_name} × ${request.quantity}`}
        badge="Revisión"
        description={`${request.customer_name} · ${formatMoney(request.final_price)} · ${PRIORITY_LABELS[request.priority] || request.priority}`}
        actions={
          <Link href="/dashboard/affiliates/requests" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm text-white hover:bg-white/25">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        }
      />

      {apiError && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Solicitud</h2>
                <p className="text-sm text-muted-foreground">ID {request.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Detail label="Producto" value={`${request.product_name} × ${request.quantity}`} />
              <Detail label="Cliente" value={request.customer_name} />
              <Detail label="Contacto" value={[request.customer_phone, request.customer_email].filter(Boolean).join(' · ') || 'Sin contacto'} />
              <Detail label="Precio final" value={formatMoney(request.final_price)} />
              <Detail label="Sugerido" value={request.suggested_price_snapshot ? formatMoney(request.suggested_price_snapshot) : 'Sin sugerido'} />
              <Detail label="Mínimo afiliado" value={request.min_price_snapshot ? formatMoney(request.min_price_snapshot) : 'Sin mínimo'} />
              <Detail label="Prioridad" value={PRIORITY_LABELS[request.priority] || request.priority} />
              <Detail label="Comisión snapshot" value={commissionLabel(request)} />
              <Detail label="Creado" value={formatDateTime(request.created_at)} />
              <div className="md:col-span-2 xl:col-span-3">
                <Detail label="Notas" value={request.customer_notes || 'Sin notas'} />
              </div>
            </div>

            <ReferenceImages images={request.reference_images || []} />

            {request.requested_changes && (
              <Alert tone="orange" text={`Cambios solicitados: ${request.requested_changes}`} />
            )}
            {request.rejection_reason && (
              <Alert tone="red" text={`Rechazo: ${request.rejection_reason}`} />
            )}
            {request.cancelled_reason && (
              <Alert tone="gray" text={`Cancelación: ${request.cancelled_reason}`} />
            )}
            {request.order_id && (
              <Link href={`/dashboard/orders/${request.order_id}`} className="inline-flex rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">
                Ver pedido generado
              </Link>
            )}
          </PanelCard>

          {canReview && (
            <PanelCard className="space-y-4">
              <h2 className="text-xl font-bold">Acciones de revisión</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={processing === 'approve'}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {processing === 'approve' ? 'Aprobando...' : 'Aprobar'}
                </button>
              </div>

              {canRequestChanges && (
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    placeholder="Cambios que debe hacer el afiliado"
                    className="flex-1 rounded-xl border bg-background px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleRequestChanges}
                    disabled={processing === 'changes' || !changeReason.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 px-4 py-2 text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                  >
                    <PenLine className="h-4 w-4" />
                    Pedir cambios
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Motivo de rechazo"
                  className="flex-1 rounded-xl border bg-background px-3 py-2"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={processing === 'reject' || !rejectionReason.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Rechazar
                </button>
              </div>
            </PanelCard>
          )}

          <PanelCard className="space-y-4">
            <h2 className="text-xl font-bold">Comentarios</h2>
            <form onSubmit={handleComment} className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  type="text"
                  value={commentMessage}
                  onChange={(event) => setCommentMessage(event.target.value)}
                  placeholder="Escribir comentario"
                  className="flex-1 rounded-xl border bg-background px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={processing === 'comment' || !commentMessage.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <MessageSquare className="h-4 w-4" />
                  Enviar
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={internalOnly}
                  onChange={(event) => setInternalOnly(event.target.checked)}
                />
                Comentario interno
              </label>
            </form>

            <div className="space-y-2">
              {detail.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{comment.author_role === 'affiliate' ? 'Afiliado' : 'DOFER'}{comment.internal_only ? ' · Interno' : ''}</span>
                    <span>{formatDateTime(comment.created_at)}</span>
                  </div>
                  <p className="mt-1">{comment.message}</p>
                </div>
              ))}
              {detail.comments.length === 0 && <p className="text-sm text-muted-foreground">Sin comentarios.</p>}
            </div>
          </PanelCard>
        </div>

        <PanelCard className="space-y-4">
          <h2 className="text-xl font-bold">Bitácora</h2>
          <div className="space-y-3">
            {detail.events.map((event) => (
              <div key={event.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{eventLabel(event.event_type)}</p>
                {event.message && <p className="text-sm text-muted-foreground">{event.message}</p>}
                <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
              </div>
            ))}
            {detail.events.length === 0 && <p className="text-sm text-muted-foreground">Sin eventos.</p>}
          </div>
        </PanelCard>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function ReferenceImages({ images }: { images: string[] }) {
  if (images.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {images.slice(0, 6).map((image, index) => (
        <a
          key={`${image.slice(0, 24)}-${index}`}
          href={image}
          target="_blank"
          rel="noreferrer"
          className="aspect-square rounded-lg border bg-cover bg-center hover:ring-2 hover:ring-primary"
          style={{ backgroundImage: `url(${image})` }}
          aria-label={`Abrir referencia ${index + 1}`}
        />
      ))}
    </div>
  )
}

function Alert({ tone, text }: { tone: 'orange' | 'red' | 'gray'; text: string }) {
  const styles = {
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }
  return <div className={`rounded-lg border p-3 text-sm ${styles[tone]}`}>{text}</div>
}

function StatusBadge({ status }: { status: AffiliateOrderRequest['status'] }) {
  const styles: Record<AffiliateOrderRequest['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    needs_changes: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<AffiliateOrderRequest['status'], string> = {
    pending: 'Pendiente',
    needs_changes: 'Requiere cambios',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
  }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>{labels[status]}</span>
}

function commissionLabel(request: AffiliateOrderRequest) {
  if (!request.commission_type_snapshot || request.commission_value_snapshot === undefined) {
    return 'Sin snapshot'
  }
  return request.commission_type_snapshot === 'percentage'
    ? `${request.commission_value_snapshot}%`
    : formatMoney(request.commission_value_snapshot)
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    'request.created': 'Solicitud creada',
    'request.updated': 'Solicitud actualizada',
    'request.approved': 'Solicitud aprobada',
    'request.rejected': 'Solicitud rechazada',
    'request.changes_requested': 'Cambios solicitados',
    'request.cancelled': 'Solicitud cancelada',
    'comment.created': 'Comentario agregado',
  }
  return labels[eventType] || eventType
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}
