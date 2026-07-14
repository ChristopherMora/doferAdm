'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  DollarSign,
  Eraser,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TrendingUp,
  WalletCards,
} from 'lucide-react'

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
  external_income: number
  total_income: number
  expenses: number
  net_profit: number
  pending: number
  overdue: number
  collection_rate: number
  payments_count: number
  order_payments_count: number
  quote_payments_count: number
  income_count: number
  expense_count: number
  reset_at?: string
  reset_reason: string
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
  external_income: number
  total_collected: number
  payments_count: number
}

interface FinanceIncome {
  id: string
  source: string
  description: string
  amount: number
  income_date: string
  payer: string
  payment_method: string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

interface FinanceExpense {
  id: string
  description: string
  category: string
  amount: number
  expense_date: string
  vendor: string
  payment_method: string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

interface ExpenseFormState {
  description: string
  category: string
  amount: string
  expense_date: string
  vendor: string
  payment_method: string
  notes: string
}

interface IncomeFormState {
  source: string
  description: string
  amount: string
  income_date: string
  payer: string
  payment_method: string
  notes: string
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

const expenseCategories: Array<{ value: string; label: string }> = [
  { value: 'materiales', label: 'Materiales' },
  { value: 'envios', label: 'Envios' },
  { value: 'nomina', label: 'Nomina' },
  { value: 'renta', label: 'Renta' },
  { value: 'software', label: 'Software' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'operacion', label: 'Operacion' },
  { value: 'otros', label: 'Otros' },
]

const incomeSources: Array<{ value: string; label: string }> = [
  { value: 'tiktok_shop', label: 'TikTok Shop' },
  { value: 'afiliados_externo', label: 'Afiliados externo' },
  { value: 'venta_efectivo', label: 'Venta en efectivo' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'otros', label: 'Otros' },
]

const paymentMethods: Array<{ value: string; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Deposito' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'tiktok_shop', label: 'TikTok Shop' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'otro', label: 'Otro' },
]

const defaultExpenseForm = (): ExpenseFormState => ({
  description: '',
  category: 'materiales',
  amount: '',
  expense_date: toDateInputValue(new Date()),
  vendor: '',
  payment_method: 'efectivo',
  notes: '',
})

const defaultIncomeForm = (): IncomeFormState => ({
  source: 'tiktok_shop',
  description: '',
  amount: '',
  income_date: toDateInputValue(new Date()),
  payer: '',
  payment_method: 'efectivo',
  notes: '',
})

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60'

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
  const [incomes, setIncomes] = useState<FinanceIncome[]>([])
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(() => defaultIncomeForm())
  const [expenses, setExpenses] = useState<FinanceExpense[]>([])
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => defaultExpenseForm())
  const [receivableFilter, setReceivableFilter] = useState<ReceivableFilter>('all')
  const [cutPeriod, setCutPeriod] = useState<CutPeriod>('week')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [incomeSaving, setIncomeSaving] = useState(false)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [deletingIncomeID, setDeletingIncomeID] = useState<string | null>(null)
  const [deletingExpenseID, setDeletingExpenseID] = useState<string | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearPassword, setClearPassword] = useState('')
  const [clearReason, setClearReason] = useState('')
  const [clearing, setClearing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const totalValue = useMemo(() => (summary ? summary.order_value + summary.quote_value : 0), [summary])

  const loadFinance = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [summaryData, paymentsData, receivablesData, cutsData, incomesData, expensesData] = await Promise.all([
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
        apiClient.get<{ incomes: FinanceIncome[] }>('/admin/finance/incomes', { params: { limit: 100 } }),
        apiClient.get<{ expenses: FinanceExpense[] }>('/admin/finance/expenses', { params: { limit: 100 } }),
      ])
      setSummary(summaryData)
      setPayments(paymentsData.payments || [])
      setReceivables(receivablesData.receivables || [])
      setCuts(cutsData.cuts || [])
      setIncomes(incomesData.incomes || [])
      setExpenses(expensesData.expenses || [])
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

  const handleCreateIncome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError(null)
    setSuccessMessage(null)

    const amount = Number(incomeForm.amount)
    if (!incomeForm.description.trim()) {
      setApiError('Describe el ingreso antes de guardarlo.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setApiError('El monto del ingreso debe ser mayor a cero.')
      return
    }

    setIncomeSaving(true)
    try {
      await apiClient.post<FinanceIncome>('/admin/finance/incomes', {
        ...incomeForm,
        amount,
      })
      setIncomeForm(defaultIncomeForm())
      setSuccessMessage('Ingreso externo registrado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo registrar el ingreso'))
    } finally {
      setIncomeSaving(false)
    }
  }

  const handleDeleteIncome = async (incomeID: string) => {
    setApiError(null)
    setSuccessMessage(null)
    setDeletingIncomeID(incomeID)

    try {
      await apiClient.delete(`/admin/finance/incomes/${incomeID}`)
      setSuccessMessage('Ingreso externo eliminado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo eliminar el ingreso'))
    } finally {
      setDeletingIncomeID(null)
    }
  }

  const handleCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError(null)
    setSuccessMessage(null)

    const amount = Number(expenseForm.amount)
    if (!expenseForm.description.trim()) {
      setApiError('Describe el gasto antes de guardarlo.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setApiError('El monto del gasto debe ser mayor a cero.')
      return
    }

    setExpenseSaving(true)
    try {
      await apiClient.post<FinanceExpense>('/admin/finance/expenses', {
        ...expenseForm,
        amount,
      })
      setExpenseForm(defaultExpenseForm())
      setSuccessMessage('Gasto registrado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo registrar el gasto'))
    } finally {
      setExpenseSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseID: string) => {
    setApiError(null)
    setSuccessMessage(null)
    setDeletingExpenseID(expenseID)

    try {
      await apiClient.delete(`/admin/finance/expenses/${expenseID}`)
      setSuccessMessage('Gasto eliminado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo eliminar el gasto'))
    } finally {
      setDeletingExpenseID(null)
    }
  }

  const handleClearFinance = async () => {
    setApiError(null)
    setSuccessMessage(null)

    if (!clearPassword.trim()) {
      setApiError('Ingresa tu contrasena para limpiar finanzas.')
      return
    }

    setClearing(true)
    try {
      await apiClient.post('/admin/finance/clear', {
        password: clearPassword,
        reason: clearReason,
      })
      setClearDialogOpen(false)
      setClearPassword('')
      setClearReason('')
      setIncomeForm(defaultIncomeForm())
      setExpenseForm(defaultExpenseForm())
      setSuccessMessage('Finanzas limpiadas. El nuevo periodo inicia desde este momento.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo limpiar finanzas'))
    } finally {
      setClearing(false)
    }
  }

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
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setClearDialogOpen(true)}
              disabled={clearing}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              <Eraser className="h-4 w-4" />
              Limpiar
            </Button>
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
          </>
        }
      />

      {apiError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {apiError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {summary?.reset_at && (
        <div className="flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" />
            Periodo financiero iniciado el {formatDateTime(summary.reset_at)}
          </div>
          {summary.reset_reason && <span className="text-cyan-800">{summary.reset_reason}</span>}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <FinanceMetric label="Valor total" value={currency.format(totalValue)} icon={<DollarSign className="h-4 w-4" />} />
            <FinanceMetric label="Ingresos" value={currency.format(summary.total_income)} icon={<WalletCards className="h-4 w-4" />} accent="text-emerald-600" />
            <FinanceMetric label="Externos" value={currency.format(summary.external_income)} icon={<DollarSign className="h-4 w-4" />} accent="text-cyan-700" />
            <FinanceMetric label="Gastos" value={currency.format(summary.expenses)} icon={<ReceiptText className="h-4 w-4" />} accent="text-red-600" />
            <FinanceMetric label="Utilidad" value={currency.format(summary.net_profit)} icon={<TrendingUp className="h-4 w-4" />} accent={summary.net_profit >= 0 ? 'text-cyan-700' : 'text-red-600'} />
            <FinanceMetric label="Vencido" value={currency.format(summary.overdue)} icon={<TrendingUp className="h-4 w-4" />} accent="text-red-600" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <PanelCard>
              <p className="text-sm text-muted-foreground">Tasa de cobranza</p>
              <p className="mt-2 text-3xl font-semibold">{summary.collection_rate.toFixed(1)}%</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Cobrado en pedidos</p>
              <p className="mt-2 text-3xl font-semibold">{currency.format(summary.collected)}</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Pagos de pedidos</p>
              <p className="mt-2 text-3xl font-semibold">{summary.payments_count}</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Ingresos externos</p>
              <p className="mt-2 text-3xl font-semibold">{summary.income_count}</p>
            </PanelCard>
            <PanelCard>
              <p className="text-sm text-muted-foreground">Gastos registrados</p>
              <p className="mt-2 text-3xl font-semibold">{summary.expense_count}</p>
            </PanelCard>
          </div>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle icon={<WalletCards className="h-5 w-5" />} title="Ingresos externos" />

        <PanelCard>
          <form onSubmit={handleCreateIncome} className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fuente</span>
              <select
                className={fieldClass}
                value={incomeForm.source}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, source: event.target.value }))}
                disabled={incomeSaving}
              >
                {incomeSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 lg:col-span-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripcion</span>
              <input
                className={fieldClass}
                value={incomeForm.description}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Pago TikTok Shop, venta externa afiliado..."
                disabled={incomeSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</span>
              <input
                className={fieldClass}
                type="number"
                min="0"
                step="0.01"
                value={incomeForm.amount}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</span>
              <input
                className={fieldClass}
                type="date"
                value={incomeForm.income_date}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, income_date: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagador</span>
              <input
                className={fieldClass}
                value={incomeForm.payer}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, payer: event.target.value }))}
                placeholder="TikTok, afiliado, cliente..."
                disabled={incomeSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metodo</span>
              <select
                className={fieldClass}
                value={incomeForm.payment_method}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, payment_method: event.target.value }))}
                disabled={incomeSaving}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 lg:col-span-7">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</span>
              <input
                className={fieldClass}
                value={incomeForm.notes}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <div className="flex items-end lg:col-span-2">
              <Button type="submit" className="w-full" disabled={incomeSaving}>
                <Plus className="h-4 w-4" />
                {incomeSaving ? 'Guardando...' : 'Agregar'}
              </Button>
            </div>
          </form>
        </PanelCard>

        {incomes.length === 0 ? (
          <EmptyState
            title="Sin ingresos externos"
            description="Pagos de TikTok Shop, afiliados externos o efectivo apareceran aqui."
            icon={<WalletCards className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Ingreso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fuente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagador / metodo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Accion</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <tr key={income.id} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{income.description}</div>
                      {income.notes && <div className="mt-1 text-xs text-muted-foreground">{income.notes}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">{incomeSourceLabel(income.source)}</Badge>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      <div>{income.payer || 'Sin pagador'}</div>
                      <div className="mt-1 text-xs">{paymentMethodLabel(income.payment_method)}</div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(income.income_date)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-600">{currency.format(income.amount)}</td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Eliminar ingreso"
                        onClick={() => void handleDeleteIncome(income.id)}
                        disabled={deletingIncomeID === income.id}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={<ReceiptText className="h-5 w-5" />} title="Gastos de Dofer" />

        <PanelCard>
          <form onSubmit={handleCreateExpense} className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <label className="space-y-1 lg:col-span-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripcion</span>
              <input
                className={fieldClass}
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Filamento PLA, renta, envio..."
                disabled={expenseSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</span>
              <select
                className={fieldClass}
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, category: event.target.value }))}
                disabled={expenseSaving}
              >
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</span>
              <input
                className={fieldClass}
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</span>
              <input
                className={fieldClass}
                type="date"
                value={expenseForm.expense_date}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, expense_date: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proveedor</span>
              <input
                className={fieldClass}
                value={expenseForm.vendor}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, vendor: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <label className="space-y-1 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metodo</span>
              <select
                className={fieldClass}
                value={expenseForm.payment_method}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, payment_method: event.target.value }))}
                disabled={expenseSaving}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 lg:col-span-7">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</span>
              <input
                className={fieldClass}
                value={expenseForm.notes}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <div className="flex items-end lg:col-span-2">
              <Button type="submit" className="w-full" disabled={expenseSaving}>
                <Plus className="h-4 w-4" />
                {expenseSaving ? 'Guardando...' : 'Agregar'}
              </Button>
            </div>
          </form>
        </PanelCard>

        {expenses.length === 0 ? (
          <EmptyState
            title="Sin gastos registrados"
            description="Los gastos operativos capturados apareceran aqui."
            icon={<ReceiptText className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Gasto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Proveedor / metodo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Accion</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b last:border-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{expense.description}</div>
                      {expense.notes && <div className="mt-1 text-xs text-muted-foreground">{expense.notes}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">{expenseCategoryLabel(expense.category)}</Badge>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      <div>{expense.vendor || 'Sin proveedor'}</div>
                      <div className="mt-1 text-xs">{paymentMethodLabel(expense.payment_method)}</div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(expense.expense_date)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-red-600">{currency.format(expense.amount)}</td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Eliminar gasto"
                        onClick={() => void handleDeleteExpense(expense.id)}
                        disabled={deletingExpenseID === expense.id}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

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
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Externos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Movs.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((cut) => (
                  <tr key={`${cut.period}-${cut.period_start}`} className="border-b last:border-0">
                    <td className="px-4 py-4 font-medium">{formatPeriod(cut.period_start, cutPeriod)}</td>
                    <td className="px-4 py-4 text-right">{currency.format(cut.order_payments)}</td>
                    <td className="px-4 py-4 text-right">{currency.format(cut.quote_payments)}</td>
                    <td className="px-4 py-4 text-right">{currency.format(cut.external_income)}</td>
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
                    <td className="px-4 py-4 text-muted-foreground">{paymentMethodLabel(payment.payment_method)}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-4 text-right font-semibold">{currency.format(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      {clearDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-red-50 p-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Limpiar finanzas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se ocultaran pagos, gastos y cortes anteriores a este momento. Los pedidos y cotizaciones no se borran.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contrasena</span>
                <input
                  className={fieldClass}
                  type="password"
                  value={clearPassword}
                  onChange={(event) => setClearPassword(event.target.value)}
                  disabled={clearing}
                  autoFocus
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo</span>
                <input
                  className={fieldClass}
                  value={clearReason}
                  onChange={(event) => setClearReason(event.target.value)}
                  disabled={clearing}
                  placeholder="Cierre de mes, reinicio operativo..."
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClearDialogOpen(false)
                  setClearPassword('')
                  setClearReason('')
                }}
                disabled={clearing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleClearFinance()}
                disabled={clearing || !clearPassword.trim()}
              >
                <Eraser className="h-4 w-4" />
                {clearing ? 'Limpiando...' : 'Limpiar'}
              </Button>
            </div>
          </div>
        </div>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function expenseCategoryLabel(value: string) {
  return expenseCategories.find((category) => category.value === value)?.label || value || 'Operacion'
}

function incomeSourceLabel(value: string) {
  return incomeSources.find((source) => source.value === value)?.label || value || 'Otros'
}

function paymentMethodLabel(value: string) {
  return paymentMethods.find((method) => method.value === value)?.label || value || 'Sin metodo'
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
