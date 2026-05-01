'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, DollarSign, RefreshCw, TrendingUp, WalletCards } from 'lucide-react'

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

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [payments, setPayments] = useState<FinancePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const totalValue = useMemo(() => (summary ? summary.order_value + summary.quote_value : 0), [summary])

  const loadFinance = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [summaryData, paymentsData] = await Promise.all([
        apiClient.get<FinanceSummary>('/admin/finance/summary'),
        apiClient.get<{ payments: FinancePayment[] }>('/admin/finance/payments', { params: { limit: 100 } }),
      ])
      setSummary(summaryData)
      setPayments(paymentsData.payments || [])
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo cargar finanzas'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

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
        description="Resumen de pagos, saldos y cobranza consolidada."
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

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <FinanceMetric label="Valor total" value={currency.format(totalValue)} icon={<DollarSign className="h-4 w-4" />} />
            <FinanceMetric label="Cobrado" value={currency.format(summary.collected)} icon={<WalletCards className="h-4 w-4" />} accent="text-emerald-600" />
            <FinanceMetric label="Pendiente" value={currency.format(summary.pending)} icon={<CreditCard className="h-4 w-4" />} accent="text-amber-600" />
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
              <p className="text-sm text-muted-foreground">Documentos</p>
              <p className="mt-2 text-3xl font-semibold">{summary.total_orders + summary.total_quotes}</p>
            </PanelCard>
          </div>
        </>
      )}

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
                  <td className="px-4 py-4 text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-4 text-right font-semibold">{currency.format(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
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
