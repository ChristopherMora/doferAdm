'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AffiliateOrderRequest } from '@/types'

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  printing: 'Imprimiendo',
  post: 'Postproceso',
  packed: 'Empacado',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baja',
}

export default function MyAffiliateOrdersPage() {
  const [requests, setRequests] = useState<AffiliateOrderRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

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

  if (loading) {
    return <LoadingState label="Cargando tus pedidos..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis pedidos"
        badge="Afiliado"
        description="Pedidos que registraste para tus clientes y su estado de revisión / producción."
        actions={
          <Link href="/affiliate/orders/new" className="px-4 py-2 bg-white/15 text-white rounded-xl hover:bg-white/25">
            + Nuevo pedido
          </Link>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      <PanelCard>
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold">{req.product_name} × {req.quantity}</h3>
                  <p className="text-sm text-muted-foreground">Cliente: {req.customer_name}</p>
                  <p className="text-xs text-muted-foreground">Prioridad: {PRIORITY_LABELS[req.priority] || req.priority}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${req.final_price.toFixed(2)}</p>
                  <ReviewBadge status={req.status} rejectionReason={req.rejection_reason} />
                </div>
              </div>

              {req.status === 'approved' && req.order_status && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Estado de producción: <span className="font-medium">{ORDER_STATUS_LABELS[req.order_status] || req.order_status}</span>
                </p>
              )}

              {req.reference_images && req.reference_images.length > 0 && (
                <div className="mt-3 grid grid-cols-4 md:grid-cols-6 gap-2">
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
            </div>
          ))}

          {requests.length === 0 && (
            <EmptyState
              title="Todavía no registras pedidos"
              description="Cuando tu cliente confirme un pedido, regístralo aquí para que DOFER lo fabrique."
              action={
                <Link href="/affiliate/orders/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">
                  Registrar mi primer pedido
                </Link>
              }
            />
          )}
        </div>
      </PanelCard>
    </div>
  )
}

function ReviewBadge({ status, rejectionReason }: { status: string; rejectionReason?: string }) {
  if (status === 'approved') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Aprobado</span>
  }
  if (status === 'rejected') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700"
        title={rejectionReason}
      >
        Rechazado
      </span>
    )
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Pendiente de revisión</span>
}
