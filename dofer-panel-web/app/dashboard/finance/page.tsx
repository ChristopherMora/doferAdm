'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, CreditCard, DollarSign, RefreshCw, TrendingUp, WalletCards } from 'lucide-react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import TableShell from '@/components/dashboard/TableShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface FinanceSummary {
  total_orders: number
  total_quotes: number
  order_value: number
  quote_value: number
  collected: number
  pending: number
  overdue: number
  collection_rate: number
  payments_count: number
  order_payments_count: number
  quote_payments_count: number
}

interface FinancePayment {
  id: string
  source_type: 'order' | 'quote'
  source_id: string
  reference: string
  customer_name: string
  amount: number
  payment_method: string
  payment_date: string
  notes: string
  created_by: string
  created_at: string
}

interface Receivable {
  id: string
  type: 'order' | 'quote'
  reference: string
  customer_name: string
  total: number
  amount_paid: number
  balance: number
  due_date?: string
  status: 'pending' | 'partial' | 'overdue' | 'paid'
  days_overdue: number
}

interface FinanceCut {
  period: 'day' | 'week' | 'month'
  period_start: string
  order_payments: number
  quote_payments: number
  total_collected: number
  payments_count: number
}

type ReceivableFilter = 'all' | 'pending' | 'partial' | 'overdue'
type CutPeriod = 'day' | 'week' | 'month'

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const receivableFilters: Array<{ value: ReceivableFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'overdue', label: 'Vencido' },
  { value: 'partial', label: 'Parcial' },
  { value: 'pending', label: 'Pendiente' },
]

const cutPeriods: Array<{ value: CutPeriod; label: string }> = [
  { value: 'day', label: 'Diario' },
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensual' },
]

const statusLabels: Record<string, string> = {
  overdue: 'Vencido',
  partial: 'Parcial',
  pending: 'Pendiente',
  paid: 'Pagado',
}

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [payments, setPayments] = useState<FinancePayment[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [cuts, setCuts] = useState<FinanceCut[]>([])
  const [receivableFilter, setReceivableFilter] = useState<ReceivableFilter>('all')
  const [cutPeriod, setCutPeriod] = useState<CutPeriod>('week')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const totalValue = useMemo(() => (summary ? summary.order_value + summary.quote_value : 0), [summary])

  const loadFinance = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [summaryData, paymentsData, receivablesData, cutsData] = await Promise.all([
        apiClient.get<FinanceSummary>('/admin/finance/summary'),
        apiClient.get<{ payments: FinancePayment[] }>('/admin/finance/payments', { params: { limit: 100 } }),
        apiClient.get<{ receivables: Receivable[] }>('/admin/finance/receivables', {
          params: {
            limit: 150,
            status: receivableFilter === 'all' ? undefined : receivableFilter,
          },
        }),
        apiClient.get<{ cuts: FinanceCut[] }>('/admin/finance/cuts', {
          params: {
            period: cutPeriod,
            limit: 18,
          },
        }),
      ])
      setSummary(summaryData)
      setPayments(paymentsData.payments || [])
      setReceivables(receivablesData.receivables || [])
      setCuts(cutsData.cuts || [])
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo cargar finanzas'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [cutPeriod, receivableFilter])

  useEffect(() => {
    void loadFinance()
  }, [loadFinance])

  if (loading) {
    return <LoadingState label="Cargando finanzas..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        badge="Cobranza"
        description="Resumen de pagos, saldos por cobrar, alertas vencidas y cortes operativos."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadFinance(true)}
            disabled={refreshing}
            className="bg-white/15 text-white hover:bg-white/25"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        }
      />

      {apiError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {apiError}
        </div>
      )}

      {summary && summary.overdue > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Hay cobranza vencida por {currency.format(summary.overdue)}
          </div>
          <span className="text-red-800">Prioriza los saldos con mas dias vencidos.</span>
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <FinanceMetric label="Valor total" value={currency.format(totalValue)} icon={<DollarSign className="h-4 w-4" />} />
            <FinanceMetric label="Cobrado" value={currency.format(summary.collected)} icon={<WalletCards className="h-4 w-4" />} accent="text-emerald-600" />
            <FinanceMetric label="Por cobrar" value={currency.format(summary.pending)} icon={<CreditCard className="h-4 w-4" />} accent="text-amber-600" />
            <FinanceMetric label="Vencido" value={currency.format(summary.overdue)} icon={<TrendingUp className="h-4 w-4" />} accent="text-red-600" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PanelCard>
              <p className="text-sm text-muted-foreground">Tasa de cobranza</p>
              <p className="mt-2 text-3xl font-semibold">{summary.collection_rate.toFixed(1)}%</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Pagos registrados</p>
              <p className="mt-2 text-3xl font-semibold">{summary.payments_count}</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Documentos con valor</p>
              <p className="mt-2 text-3xl font-semibold">{summary.total_orders + summary.total_quotes}</p>
            </PanelCard>
          </div>
        </>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle icon={<CreditCard className="h-5 w-5" />} title="Por cobrar" />
          <div className="flex flex-wrap gap-2">
            {receivableFilters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={receivableFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReceivableFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {receivables.length === 0 ? (
          <EmptyState
            title="Sin saldos pendientes"
            description="Cuando una orden o cotizacion tenga balance pendiente, aparecera aqui."
            icon={<CreditCard className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Referencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Vence</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{item.reference}</div>
                      <Badge variant="outline" className="mt-1">
                        {item.type === 'order' ? 'Orden' : 'Cotizacion'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{item.customer_name}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                      {item.days_overdue > 0 && (
                        <div className="mt-1 text-xs text-red-600">{item.days_overdue} dias vencido</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{item.due_date ? formatDate(item.due_date) : 'Sin fecha'}</td>
                    <td className="px-4 py-4 text-right">{currency.format(item.total)}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground">{currency.format(item.amount_paid)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-600">{currency.format(item.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle icon={<CalendarDays className="h-5 w-5" />} title="Cortes de cobranza" />
          <div className="flex flex-wrap gap-2">
            {cutPeriods.map((period) => (
              <Button
                key={period.value}
                type="button"
                variant={cutPeriod === period.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCutPeriod(period.value)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>

        {cuts.length === 0 ? (
          <EmptyState
            title="Sin cortes aun"
            description="Los cortes se llenan con los pagos capturados en ordenes y cotizaciones."
            icon={<CalendarDays className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Periodo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Ordenes</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Cotizaciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((cut) => (
                  <tr key={`${cut.period}-${cut.period_start}`} className="border-b last:border-0">
                    <td className="px-4 py-4 font-medium">{formatPeriod(cut.period_start, cutPeriod)}</td>
                    <td className="px-4 py-4 text-right">{currency.format(cut.order_payments)}</td>
                    <td className="px-4 py-4 text-right">{currency.format(cut.quote_payments)}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground">{cut.payments_count}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">{currency.format(cut.total_collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={<WalletCards className="h-5 w-5" />} title="Pagos recientes" />
        {payments.length === 0 ? (
          <EmptyState
            title="Sin pagos registrados"
            description="Los pagos capturados en ordenes y cotizaciones apareceran aqui."
            icon={<CreditCard className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Referencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Metodo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={`${payment.source_type}-${payment.id}`} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{payment.reference}</div>
                      <Badge variant="outline" className="mt-1">
                        {payment.source_type === 'order' ? 'Orden' : 'Cotizacion'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{payment.customer_name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{payment.payment_method || 'Sin metodo'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-4 text-right font-semibold">{currency.format(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>
    </div>
  )
}

function FinanceMetric({
  label,
  value,
  icon,
  accent = 'text-foreground',
}: {
  label: string
  value: string
  icon: ReactNode
  accent?: string
}) {
  return (
    <PanelCard>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</p>
    </PanelCard>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  )
}

function StatusBadge({ status }: { status: Receivable['status'] }) {
  const classes: Record<string, string> = {
    overdue: 'border-red-300 bg-red-50 text-red-700',
    partial: 'border-amber-300 bg-amber-50 text-amber-700',
    pending: 'border-slate-300 bg-slate-50 text-slate-700',
    paid: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  }

  return (
    <Badge variant="outline" className={classes[status]}>
      {statusLabels[status] || status}
    </Badge>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatPeriod(value: string, period: CutPeriod) {
  const date = new Date(value)
  if (period === 'day') return formatDate(value)
  if (period === 'month') {
    return date.toLocaleDateString('es-MX', {
      month: 'long',
      year: 'numeric',
    })
  }

  return `Semana de ${formatDate(value)}`
}
