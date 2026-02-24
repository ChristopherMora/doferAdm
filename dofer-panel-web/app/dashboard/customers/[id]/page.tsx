'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CustomerRecord {
  id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  customer_tier: string
  status: string
  total_orders: number
  total_spent: number
  average_order_value: number
  discount_percentage: number
  internal_notes?: string | null
  tags: string[]
  last_order_date?: string | null
  created_at: string
  updated_at: string
}

interface CustomerSummary {
  total_orders: number
  total_quotes: number
  total_payments: number
  total_paid: number
  outstanding_total: number
  last_activity_at?: string | null
}

interface CustomerOrder {
  id: string
  order_number: string
  status: string
  priority: string
  product_name: string
  amount: number
  amount_paid: number
  balance: number
  created_at: string
  delivery_deadline?: string | null
}

interface CustomerQuote {
  id: string
  quote_number: string
  status: string
  total: number
  amount_paid: number
  balance: number
  valid_until?: string | null
  created_at: string
  converted_to_order_id?: string
}

interface CustomerPayment {
  id: string
  source_type: 'order' | 'quote'
  source_id: string
  source_number: string
  amount: number
  payment_method: string
  payment_date: string
  notes: string
  created_at: string
}

interface CustomerInteraction {
  id: string
  interaction_type: string
  subject?: string | null
  description?: string | null
  created_by?: string | null
  created_at: string
}

interface LastContact {
  interaction_type: string
  subject: string
  description: string
  created_at: string
  created_by: string
}

interface CustomerProfile360 {
  customer: CustomerRecord
  summary: CustomerSummary
  notes: string
  last_contact?: LastContact | null
  orders: CustomerOrder[]
  quotes: CustomerQuote[]
  payments: CustomerPayment[]
  interactions: CustomerInteraction[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
    case 'approved':
    case 'delivered':
      return 'default'
    case 'blocked':
    case 'rejected':
    case 'cancelled':
      return 'destructive'
    case 'pending':
    case 'new':
      return 'secondary'
    default:
      return 'outline'
  }
}

export default function CustomerProfile360Page() {
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()
  const customerID = params.id as string

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CustomerProfile360 | null>(null)
  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: 'note',
    subject: '',
    description: '',
    priority: 'normal',
  })

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<CustomerProfile360>(`/customers/${customerID}/profile-360`)
      setProfile(data)
    } catch (error) {
      console.error('Error loading customer profile 360:', error)
      addToast({
        title: 'Error al cargar ficha del cliente',
        description: error instanceof Error ? error.message : 'No se pudo cargar la ficha 360.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, customerID])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleAddInteraction = async () => {
    try {
      await apiClient.post(`/customers/${customerID}/interactions`, newInteraction)
      addToast({
        title: 'Interaccion registrada',
        description: 'La interaccion se agrego al historial del cliente.',
        variant: 'success',
      })
      setShowInteractionModal(false)
      setNewInteraction({
        interaction_type: 'note',
        subject: '',
        description: '',
        priority: 'normal',
      })
      await loadProfile()
    } catch (error) {
      console.error('Error creating interaction:', error)
      addToast({
        title: 'Error al registrar interaccion',
        description: error instanceof Error ? error.message : 'No se pudo guardar la interaccion.',
        variant: 'error',
      })
    }
  }

  const metrics = useMemo(() => {
    if (!profile) {
      return {
        totalOrders: 0,
        totalQuotes: 0,
        totalPayments: 0,
        totalPaid: 0,
        outstanding: 0,
      }
    }
    return {
      totalOrders: profile.summary.total_orders,
      totalQuotes: profile.summary.total_quotes,
      totalPayments: profile.summary.total_payments,
      totalPaid: profile.summary.total_paid,
      outstanding: profile.summary.outstanding_total,
    }
  }, [profile])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No se encontro el cliente solicitado.</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push('/dashboard/customers')}>
            Volver a clientes
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/dashboard/customers')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver a clientes
          </button>
          <h1 className="text-3xl font-bold">{profile.customer.name}</h1>
          <p className="text-sm text-muted-foreground">{profile.customer.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant(profile.customer.status)}>
            Estado: {profile.customer.status}
          </Badge>
          <Badge variant="outline">
            Tier: {profile.customer.customer_tier}
          </Badge>
          <Button onClick={() => setShowInteractionModal(true)}>
            Nueva interaccion
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Ordenes</p>
            <p className="text-2xl font-semibold">{metrics.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Cotizaciones</p>
            <p className="text-2xl font-semibold">{metrics.totalQuotes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Pagos</p>
            <p className="text-2xl font-semibold">{metrics.totalPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Total pagado</p>
            <p className="text-xl font-semibold">{formatCurrency(metrics.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Saldo pendiente</p>
            <p className="text-xl font-semibold">{formatCurrency(metrics.outstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-lg font-semibold">Ultimo contacto</h2>
            {profile.last_contact ? (
              <>
                <p className="text-sm">
                  <span className="text-muted-foreground">Tipo:</span> {profile.last_contact.interaction_type}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Asunto:</span> {profile.last_contact.subject || 'Sin asunto'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile.last_contact.description || 'Sin descripcion'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(profile.last_contact.created_at)} por {profile.last_contact.created_by || 'sistema'}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay interacciones registradas.</p>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground uppercase">Ultima actividad global</p>
              <p className="text-sm">{formatDateTime(profile.summary.last_activity_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-lg font-semibold">Notas del cliente</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {profile.notes || 'Sin notas internas registradas.'}
            </p>
            {!!profile.customer.phone && (
              <p className="text-sm">
                <span className="text-muted-foreground">Telefono:</span> {profile.customer.phone}
              </p>
            )}
            {!!profile.customer.company && (
              <p className="text-sm">
                <span className="text-muted-foreground">Empresa:</span> {profile.customer.company}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Cliente desde {formatDate(profile.customer.created_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-xl font-semibold">Historial de ordenes</h2>
          {profile.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ordenes asociadas.</p>
          ) : (
            <div className="space-y-2">
              {profile.orders.map((order) => (
                <div key={order.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">{order.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                      <Badge variant="outline">{order.priority}</Badge>
                    </div>
                    <p className="text-sm mt-1">Total: {formatCurrency(order.amount)}</p>
                    <p className="text-xs text-muted-foreground">Saldo: {formatCurrency(order.balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">Historial de cotizaciones</h2>
            {profile.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cotizaciones asociadas.</p>
            ) : (
              <div className="space-y-2">
                {profile.quotes.map((quote) => (
                  <div key={quote.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{quote.quote_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Creada {formatDateTime(quote.created_at)} {quote.valid_until ? `· Vence ${formatDate(quote.valid_until)}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusVariant(quote.status)}>{quote.status}</Badge>
                      <p className="text-sm mt-1">Total: {formatCurrency(quote.total)}</p>
                      <p className="text-xs text-muted-foreground">Saldo: {formatCurrency(quote.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">Historial de pagos</h2>
            {profile.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
            ) : (
              <div className="space-y-2">
                {profile.payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{payment.source_type === 'order' ? 'Orden' : 'Cotizacion'} {payment.source_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(payment.payment_date)}</p>
                      {payment.notes && (
                        <p className="text-xs text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{payment.payment_method || 'Metodo no definido'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-xl font-semibold">Interacciones recientes</h2>
          {profile.interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay interacciones registradas.</p>
          ) : (
            <div className="space-y-2">
              {profile.interactions.slice(0, 12).map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.subject || 'Sin asunto'}</p>
                    <Badge variant="outline">{item.interaction_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.description || 'Sin descripcion'}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDateTime(item.created_at)} · {item.created_by || 'sistema'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showInteractionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold">Nueva interaccion</h2>

            <div>
              <label className="text-sm text-muted-foreground">Tipo</label>
              <select
                value={newInteraction.interaction_type}
                onChange={(e) => setNewInteraction((prev) => ({ ...prev, interaction_type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
              >
                <option value="note">Nota</option>
                <option value="email">Email</option>
                <option value="phone">Llamada</option>
                <option value="meeting">Reunion</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Asunto</label>
              <input
                type="text"
                value={newInteraction.subject}
                onChange={(e) => setNewInteraction((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                placeholder="Resumen breve"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Descripcion</label>
              <textarea
                value={newInteraction.description}
                onChange={(e) => setNewInteraction((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg resize-none"
                placeholder="Detalle de la interaccion"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleAddInteraction}>
                Guardar
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setShowInteractionModal(false)
                  setNewInteraction({
                    interaction_type: 'note',
                    subject: '',
                    description: '',
                    priority: 'normal',
                  })
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

