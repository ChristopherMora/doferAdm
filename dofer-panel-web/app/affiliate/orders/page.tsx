'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Clock3, PackageCheck, Plus, Search, XCircle } from 'lucide-react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateOrderRequest } from '@/types'

type ReviewFilter = 'all' | 'pending' | 'needs_changes' | 'approved' | 'rejected' | 'cancelled'
type PriorityFilter = 'all' | 'urgent' | 'normal' | 'low'

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  printing: 'Imprimiendo',
  post: 'Postproceso',
  packed: 'Empacado',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const PRODUCTION_STEPS = ['new', 'printing', 'post', 'packed', 'ready', 'delivered']

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baja',
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'border-red-300 bg-red-50 text-red-700',
  normal: 'border-blue-300 bg-blue-50 text-blue-700',
  low: 'border-gray-300 bg-gray-50 text-gray-700',
}

export default function MyAffiliateOrdersPage() {
  const [requests, setRequests] = useState<AffiliateOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<{ requests: AffiliateOrderRequest[] }>('/affiliates/me/requests')
      setRequests(response.requests || [])
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando tus pedidos'))
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const approved = requests.filter((req) => req.status === 'approved')
    return {
      total: requests.length,
      pending: requests.filter((req) => req.status === 'pending').length,
      needsChanges: requests.filter((req) => req.status === 'needs_changes').length,
      approved: approved.length,
      rejected: requests.filter((req) => req.status === 'rejected').length,
      cancelled: requests.filter((req) => req.status === 'cancelled').length,
      inProduction: approved.filter((req) => req.order_status && !['delivered', 'cancelled'].includes(req.order_status)).length,
      delivered: approved.filter((req) => req.order_status === 'delivered').length,
      sales: approved.reduce((sum, req) => sum + req.final_price, 0),
    }
  }, [requests])

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return requests.filter((req) => {
      const matchesReview = reviewFilter === 'all' || req.status === reviewFilter
      const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter
      const matchesQuery =
        normalizedQuery === '' ||
        req.product_name.toLowerCase().includes(normalizedQuery) ||
        req.customer_name.toLowerCase().includes(normalizedQuery) ||
        (req.customer_phone || '').toLowerCase().includes(normalizedQuery) ||
        (req.customer_email || '').toLowerCase().includes(normalizedQuery)

      return matchesReview && matchesPriority && matchesQuery
    })
  }, [priorityFilter, query, requests, reviewFilter])

  if (loading) {
    return <LoadingState label="Cargando tus pedidos..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis pedidos"
        badge="Afiliado"
        description="Seguimiento de revisión, producción, referencias y ventas aprobadas."
        actions={
          <Link
            href="/affiliate/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-white hover:bg-white/25"
          >
            <Plus className="h-4 w-4" />
            Nuevo pedido
          </Link>
        }
      />

      {apiError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Total" value={summary.total} />
        <Metric label="Pendientes" value={summary.pending} tone="yellow" />
        <Metric label="Cambios" value={summary.needsChanges} tone="orange" />
        <Metric label="Aprobados" value={summary.approved} tone="green" />
        <Metric label="En producción" value={summary.inProduction} tone="blue" />
        <Metric label="Entregados" value={summary.delivered} tone="green" />
        <Metric label="Cancelados" value={summary.cancelled} />
        <Metric label="Venta aprobada" value={`$${summary.sales.toFixed(2)}`} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente, producto, teléfono o email"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={reviewFilter}
          onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="needs_changes">Requieren cambios</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Toda prioridad</option>
          <option value="urgent">Urgente</option>
          <option value="normal">Normal</option>
          <option value="low">Baja</option>
        </select>
      </section>

      <section className="space-y-3">
        {filteredRequests.map((req) => {
          const isExpanded = expandedId === req.id
          return (
            <article key={req.id} className="rounded-xl border border-border/70 bg-background/90 p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold">{req.product_name} x {req.quantity}</h3>
                    <ReviewBadge status={req.status} rejectionReason={req.rejection_reason} />
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.normal}`}>
                      {PRIORITY_LABELS[req.priority] || req.priority}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                    <span>Cliente: <strong className="text-foreground">{req.customer_name}</strong></span>
                    <span>Fecha: {new Date(req.created_at).toLocaleDateString()}</span>
                    <span>Pedido: {shortID(req.id)}</span>
                    <span>Precio final: <strong className="text-foreground">${req.final_price.toFixed(2)}</strong></span>
                  </div>

                  {req.status === 'approved' && (
                    <div className="mt-4">
                      <ProductionTimeline status={req.order_status || 'new'} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                  <Link
                    href={`/affiliate/orders/${req.id}`}
                    className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    Abrir control
                  </Link>
                </div>
              </div>

              {req.reference_images && req.reference_images.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {req.reference_images.slice(0, 6).map((image, index) => (
                    <a
                      key={`${req.id}-${index}`}
                      href={image}
                      target="_blank"
                      rel="noreferrer"
                      className="h-16 w-16 rounded-lg border bg-cover bg-center hover:ring-2 hover:ring-primary"
                      style={{ backgroundImage: `url(${image})` }}
                      aria-label={`Abrir referencia ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              {isExpanded && (
                <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2 xl:grid-cols-4">
                  <Detail label="Email" value={req.customer_email || 'Sin email'} />
                  <Detail label="Teléfono" value={req.customer_phone || 'Sin teléfono'} />
                  <Detail label="Sugerido" value={req.suggested_price_snapshot ? `$${req.suggested_price_snapshot.toFixed(2)}` : 'Sin sugerido'} />
                  <Detail label="Mínimo" value={req.min_price_snapshot ? `$${req.min_price_snapshot.toFixed(2)}` : 'Sin mínimo'} />
                  <div className="md:col-span-2 xl:col-span-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                    <p className="mt-1 text-sm">{req.customer_notes || 'Sin notas adicionales.'}</p>
                  </div>
                  {req.status === 'rejected' && (
                    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      Motivo de rechazo: {req.rejection_reason || 'No especificado'}
                    </div>
                  )}
                  {req.status === 'needs_changes' && (
                    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                      Cambios solicitados: {req.requested_changes || 'Revisa el detalle para actualizar la solicitud.'}
                    </div>
                  )}
                  {req.status === 'cancelled' && (
                    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                      Cancelado: {req.cancelled_reason || 'Sin motivo especificado'}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}

        {filteredRequests.length === 0 && (
          <EmptyState
            title={requests.length === 0 ? 'Todavía no registras pedidos' : 'No hay pedidos con esos filtros'}
            description={
              requests.length === 0
                ? 'Cuando tu cliente confirme un pedido, regístralo aquí para que DOFER lo fabrique.'
                : 'Ajusta la búsqueda o cambia los filtros para revisar otros pedidos.'
            }
            action={
              <Link href="/affiliate/orders/new" className="rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
                Registrar pedido
              </Link>
            }
          />
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: 'yellow' | 'orange' | 'green' | 'blue' }) {
  const toneClasses: Record<'yellow' | 'orange' | 'green' | 'blue', string> = {
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
    blue: 'text-blue-600',
  }
  const toneClass = tone ? toneClasses[tone] : 'text-foreground'

  return (
    <div className="rounded-xl border border-border/70 bg-background/85 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
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

function ReviewBadge({ status, rejectionReason }: { status: string; rejectionReason?: string }) {
  if (status === 'needs_changes') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
        <AlertTriangle className="h-3 w-3" />
        Requiere cambios
      </span>
    )
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Aprobado
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
        title={rejectionReason}
      >
        <XCircle className="h-3 w-3" />
        Rechazado
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        <Ban className="h-3 w-3" />
        Cancelado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
      <Clock3 className="h-3 w-3" />
      Pendiente
    </span>
  )
}

function ProductionTimeline({ status }: { status: string }) {
  const currentIndex = PRODUCTION_STEPS.indexOf(status)
  const safeIndex = currentIndex === -1 ? 0 : currentIndex

  if (status === 'cancelled') {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <XCircle className="h-4 w-4" />
        Producción cancelada
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <PackageCheck className="h-4 w-4 text-primary" />
        Estado de producción: {ORDER_STATUS_LABELS[status] || status}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {PRODUCTION_STEPS.map((step, index) => {
          const isDone = index <= safeIndex
          return (
            <div key={step} className="min-w-0">
              <div className={`h-2 rounded-full ${isDone ? 'bg-primary' : 'bg-muted'}`} />
              <div className="mt-1 truncate text-[10px] text-muted-foreground">{ORDER_STATUS_LABELS[step]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function shortID(id: string) {
  return id.slice(0, 8).toUpperCase()
}
