'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Ban, MessageSquare, Save } from 'lucide-react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { imageFileToOptimizedDataURL } from '@/lib/images'
import type { AffiliateOrderRequest, AffiliateOrderRequestDetail, Product } from '@/types'

interface RequestForm {
  product_id: string
  product_name: string
  quantity: number
  final_price: string
  priority: 'urgent' | 'normal' | 'low'
  reference_images: string[]
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_notes: string
}

const initialForm: RequestForm = {
  product_id: '',
  product_name: '',
  quantity: 1,
  final_price: '',
  priority: 'normal',
  reference_images: [],
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_notes: '',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baja',
}

export default function AffiliateOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const requestID = params.id

  const [detail, setDetail] = useState<AffiliateOrderRequestDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<RequestForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingImages, setProcessingImages] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [commentMessage, setCommentMessage] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const [detailRes, productsRes] = await Promise.all([
        apiClient.get<AffiliateOrderRequestDetail>(`/affiliates/me/requests/${requestID}`),
        apiClient.get<{ products: Product[] }>('/affiliates/me/products').catch(() => ({ products: [] })),
      ])
      setDetail(detailRes)
      setProducts(productsRes.products || [])
      setForm(fromRequest(detailRes.request))
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

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product_id),
    [form.product_id, products],
  )

  const canEdit = detail?.request.status === 'pending' || detail?.request.status === 'needs_changes'
  const canCancel = canEdit

  const handleSelectProduct = (productID: string) => {
    const product = products.find((item) => item.id === productID)
    setForm((prev) => ({
      ...prev,
      product_id: productID,
      product_name: product?.name || prev.product_name,
      final_price: product?.suggested_price
        ? String(product.suggested_price)
        : product?.affiliate_min_price
          ? String(product.affiliate_min_price)
          : prev.final_price,
    }))
  }

  const handleReferenceImages = async (files: FileList | null) => {
    if (!files) return
    const selectedFiles = Array.from(files).slice(0, 6)
    setProcessingImages(true)
    setApiError(null)
    try {
      const images = await Promise.all(selectedFiles.map(imageFileToOptimizedDataURL))
      setForm((prev) => ({ ...prev, reference_images: images }))
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudieron procesar las imágenes'))
    } finally {
      setProcessingImages(false)
    }
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setApiError(null)
    try {
      await apiClient.put(`/affiliates/me/requests/${requestID}`, {
        product_id: form.product_id || undefined,
        product_name: form.product_name,
        quantity: form.quantity,
        final_price: Number(form.final_price),
        priority: form.priority,
        reference_images: form.reference_images,
        customer_name: form.customer_name,
        customer_email: form.customer_email || undefined,
        customer_phone: form.customer_phone || undefined,
        customer_notes: form.customer_notes || undefined,
      })
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error guardando cambios'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    setSaving(true)
    setApiError(null)
    try {
      await apiClient.patch(`/affiliates/me/requests/${requestID}/cancel`, { reason: cancelReason || undefined })
      setShowCancel(false)
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cancelando solicitud'))
    } finally {
      setSaving(false)
    }
  }

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!commentMessage.trim()) return
    setSubmittingComment(true)
    setApiError(null)
    try {
      await apiClient.post(`/affiliates/me/requests/${requestID}/comments`, { message: commentMessage })
      setCommentMessage('')
      await load()
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error enviando comentario'))
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando solicitud..." />
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Solicitud" badge="Afiliado" />
        {apiError && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</div>}
      </div>
    )
  }

  const request = detail.request

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${request.product_name} × ${request.quantity}`}
        badge="Solicitud"
        description={`${request.customer_name} · ${formatMoney(request.final_price)} · ${PRIORITY_LABELS[request.priority] || request.priority}`}
        actions={
          <Link href="/affiliate/orders" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm text-white hover:bg-white/25">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        }
      />

      {apiError && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Datos del pedido</h2>
                <p className="text-sm text-muted-foreground">ID {request.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>

            {request.requested_changes && request.status === 'needs_changes' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                Cambios solicitados: {request.requested_changes}
              </div>
            )}

            {canEdit ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Producto del catálogo</label>
                  <select
                    value={form.product_id}
                    onChange={(event) => handleSelectProduct(event.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2"
                  >
                    <option value="">Producto personalizado</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}{product.suggested_price ? ` - sugerido $${product.suggested_price.toFixed(2)}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedProduct?.affiliate_min_price ? (
                    <p className="mt-1 text-xs text-muted-foreground">Mínimo afiliado: {formatMoney(selectedProduct.affiliate_min_price)}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={form.product_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))}
                    placeholder="Producto"
                    className="rounded-xl border bg-background px-3 py-2 md:col-span-2"
                    required
                  />
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                    className="rounded-xl border bg-background px-3 py-2"
                    required
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Precio final</span>
                    <input
                      type="number"
                      min={selectedProduct?.affiliate_min_price || 0}
                      step="0.01"
                      value={form.final_price}
                      onChange={(event) => setForm((prev) => ({ ...prev, final_price: event.target.value }))}
                      className="w-full rounded-xl border bg-background px-3 py-2"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Prioridad</span>
                    <select
                      value={form.priority}
                      onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as RequestForm['priority'] }))}
                      className="w-full rounded-xl border bg-background px-3 py-2"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgente</option>
                      <option value="low">Baja</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, customer_name: event.target.value }))}
                    placeholder="Cliente"
                    className="rounded-xl border bg-background px-3 py-2"
                    required
                  />
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(event) => setForm((prev) => ({ ...prev, customer_email: event.target.value }))}
                    placeholder="Email"
                    className="rounded-xl border bg-background px-3 py-2"
                  />
                  <input
                    type="text"
                    value={form.customer_phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, customer_phone: event.target.value }))}
                    placeholder="Teléfono"
                    className="rounded-xl border bg-background px-3 py-2"
                  />
                </div>

                <textarea
                  value={form.customer_notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, customer_notes: event.target.value }))}
                  placeholder="Notas del cliente"
                  className="w-full rounded-xl border bg-background px-3 py-2"
                  rows={3}
                />

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Imágenes de referencia</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={processingImages}
                    onChange={(event) => void handleReferenceImages(event.target.files)}
                    className="w-full rounded-xl border bg-background px-3 py-2"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {processingImages ? 'Optimizando imágenes...' : 'Máximo 6 imágenes; se comprimen antes de enviarse.'}
                  </span>
                </label>

                <ReferenceImages
                  images={form.reference_images}
                  onRemove={(index) => setForm((prev) => ({ ...prev, reference_images: prev.reference_images.filter((_, itemIndex) => itemIndex !== index) }))}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving || processingImages}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {processingImages ? 'Optimizando...' : saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setShowCancel((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      <Ban className="h-4 w-4" />
                      Cancelar solicitud
                    </button>
                  )}
                </div>

                {showCancel && (
                  <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 md:flex-row md:items-center">
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Motivo de cancelación"
                      className="flex-1 rounded-xl border bg-background px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <ReadOnlyRequest request={request} />
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <h2 className="text-xl font-bold">Comentarios</h2>
            <form onSubmit={handleComment} className="flex flex-col gap-2 md:flex-row">
              <input
                type="text"
                value={commentMessage}
                onChange={(event) => setCommentMessage(event.target.value)}
                placeholder="Escribir comentario"
                className="flex-1 rounded-xl border bg-background px-3 py-2"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentMessage.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar
              </button>
            </form>
            <div className="space-y-2">
              {detail.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{comment.author_role === 'affiliate' ? 'Afiliado' : 'DOFER'}</span>
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

function fromRequest(request: AffiliateOrderRequest): RequestForm {
  return {
    product_id: request.product_id || '',
    product_name: request.product_name,
    quantity: request.quantity,
    final_price: String(request.final_price),
    priority: request.priority,
    reference_images: request.reference_images || [],
    customer_name: request.customer_name,
    customer_email: request.customer_email || '',
    customer_phone: request.customer_phone || '',
    customer_notes: request.customer_notes || '',
  }
}

function ReadOnlyRequest({ request }: { request: AffiliateOrderRequest }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Detail label="Producto" value={`${request.product_name} × ${request.quantity}`} />
      <Detail label="Precio final" value={formatMoney(request.final_price)} />
      <Detail label="Cliente" value={request.customer_name} />
      <Detail label="Contacto" value={[request.customer_phone, request.customer_email].filter(Boolean).join(' · ') || 'Sin contacto'} />
      <Detail label="Prioridad" value={PRIORITY_LABELS[request.priority] || request.priority} />
      <Detail label="Comisión registrada" value={commissionLabel(request)} />
      <div className="md:col-span-2">
        <Detail label="Notas" value={request.customer_notes || 'Sin notas'} />
      </div>
      <div className="md:col-span-2">
        <ReferenceImages images={request.reference_images || []} />
      </div>
      {request.rejection_reason && (
        <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Rechazo: {request.rejection_reason}
        </div>
      )}
      {request.cancelled_reason && (
        <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Cancelación: {request.cancelled_reason}
        </div>
      )}
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

function ReferenceImages({ images, onRemove }: { images: string[]; onRemove?: (index: number) => void }) {
  if (images.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {images.slice(0, 6).map((image, index) => (
        <div key={`${image.slice(0, 24)}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url(${image})` }}>
          <a href={image} target="_blank" rel="noreferrer" className="absolute inset-0" aria-label={`Abrir referencia ${index + 1}`} />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1 top-1 rounded-md bg-background/90 px-2 py-1 text-xs shadow"
            >
              Quitar
            </button>
          )}
        </div>
      ))}
    </div>
  )
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
