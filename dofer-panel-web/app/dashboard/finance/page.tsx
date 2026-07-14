'use client'

import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  CreditCard,
  DollarSign,
  Eraser,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
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
  total_income: number
  expenses: number
  net_profit: number
  personal_withdrawals: number
  available_cash: number
  monthly_income: number
  monthly_goal: number
  monthly_goal_progress: number
  monthly_goal_remaining: number
  income_count: number
  expense_count: number
  withdrawal_count: number
  reset_at?: string
  reset_reason: string
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
  created_at: string
}

interface FinanceExpense {
  id: string
  description: string
  category: string
  amount: number
  expense_date: string
  payment_method: string
  notes: string
  created_at: string
}

interface FinanceWithdrawal {
  id: string
  amount: number
  withdrawal_date: string
  reason: string
  created_at: string
}

interface FinanceHistoryEntry {
  id: string
  type: 'income' | 'expense' | 'withdrawal'
  category: string
  description: string
  amount: number
  signed_amount: number
  movement_date: string
  balance_remaining: number
}

interface IncomeFormState {
  source: string
  description: string
  amount: string
  income_date: string
  payment_method: string
  payer: string
  notes: string
}

interface ExpenseFormState {
  category: string
  description: string
  amount: string
  expense_date: string
  payment_method: string
  notes: string
}

interface WithdrawalFormState {
  amount: string
  withdrawal_date: string
  reason: string
}

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const incomeSources: Array<{ value: string; label: string }> = [
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'tiktok_shop', label: 'TikTok Shop' },
  { value: 'mercado_libre', label: 'Mercado Libre' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'ventas_locales', label: 'Ventas locales' },
  { value: 'otros', label: 'Otros ingresos' },
]

const expenseCategories: Array<{ value: string; label: string }> = [
  { value: 'filamento', label: 'Filamento' },
  { value: 'empaque', label: 'Empaque' },
  { value: 'envios', label: 'Envios' },
  { value: 'comision_afiliado', label: 'Comision afiliado' },
  { value: 'herramientas', label: 'Herramientas' },
  { value: 'publicidad', label: 'Publicidad' },
  { value: 'renta', label: 'Renta' },
  { value: 'luz', label: 'Luz' },
  { value: 'internet', label: 'Internet' },
  { value: 'otros', label: 'Otros' },
]

const paymentMethods: Array<{ value: string; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Deposito' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'otro', label: 'Otro' },
]

const withdrawalReasons: Array<{ value: string; label: string }> = [
  { value: 'pago_tarjeta', label: 'Pago tarjeta' },
  { value: 'gasto_personal', label: 'Gasto personal' },
  { value: 'retiro_efectivo', label: 'Retiro de efectivo' },
  { value: 'otro', label: 'Otro retiro' },
]

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60'

const defaultIncomeForm = (): IncomeFormState => ({
  source: 'pedidos',
  description: '',
  amount: '',
  income_date: toDateInputValue(new Date()),
  payment_method: 'efectivo',
  payer: '',
  notes: '',
})

const defaultExpenseForm = (): ExpenseFormState => ({
  category: 'filamento',
  description: '',
  amount: '',
  expense_date: toDateInputValue(new Date()),
  payment_method: 'efectivo',
  notes: '',
})

const defaultWithdrawalForm = (): WithdrawalFormState => ({
  amount: '',
  withdrawal_date: toDateInputValue(new Date()),
  reason: 'pago_tarjeta',
})

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [history, setHistory] = useState<FinanceHistoryEntry[]>([])
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(() => defaultIncomeForm())
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => defaultExpenseForm())
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalFormState>(() => defaultWithdrawalForm())
  const [monthlyGoal, setMonthlyGoal] = useState('30000')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [incomeSaving, setIncomeSaving] = useState(false)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [withdrawalSaving, setWithdrawalSaving] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearPassword, setClearPassword] = useState('')
  const [clearReason, setClearReason] = useState('')
  const [clearing, setClearing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadFinance = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setApiError(null)

    try {
      const [summaryData, historyData] = await Promise.all([
        apiClient.get<FinanceSummary>('/admin/finance/summary'),
        apiClient.get<{ history: FinanceHistoryEntry[] }>('/admin/finance/history', { params: { limit: 200 } }),
      ])
      setSummary(summaryData)
      setHistory(historyData.history || [])
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

  useEffect(() => {
    if (summary) {
      setMonthlyGoal(String(summary.monthly_goal || 0))
    }
  }, [summary])

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
      setSuccessMessage('Ingreso registrado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo registrar el ingreso'))
    } finally {
      setIncomeSaving(false)
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
        vendor: '',
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

  const handleCreateWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError(null)
    setSuccessMessage(null)

    const amount = Number(withdrawalForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setApiError('El monto del retiro debe ser mayor a cero.')
      return
    }

    setWithdrawalSaving(true)
    try {
      await apiClient.post<FinanceWithdrawal>('/admin/finance/withdrawals', {
        ...withdrawalForm,
        amount,
        reason: withdrawalReasonLabel(withdrawalForm.reason),
      })
      setWithdrawalForm(defaultWithdrawalForm())
      setSuccessMessage('Retiro personal registrado.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo registrar el retiro'))
    } finally {
      setWithdrawalSaving(false)
    }
  }

  const handleUpdateMonthlyGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError(null)
    setSuccessMessage(null)

    const amount = Number(monthlyGoal)
    if (!Number.isFinite(amount) || amount < 0) {
      setApiError('La meta mensual debe ser cero o mayor.')
      return
    }

    setGoalSaving(true)
    try {
      await apiClient.patch('/admin/finance/monthly-goal', { amount })
      setSuccessMessage('Meta mensual actualizada.')
      await loadFinance(true)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudo actualizar la meta mensual'))
    } finally {
      setGoalSaving(false)
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
      setWithdrawalForm(defaultWithdrawalForm())
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

  const goalProgress = summary ? Math.min(summary.monthly_goal_progress, 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        badge="Control simple"
        description="Ingresos, gastos, utilidad, retiros personales y dinero disponible de DOFER."
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

      {summary && (
        <>
          <PanelCard>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  Meta mensual
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-semibold">{currency.format(summary.monthly_income)}</p>
                  <p className="pb-1 text-sm text-muted-foreground">/ {currency.format(summary.monthly_goal)}</p>
                  <Badge variant="outline">{summary.monthly_goal_progress.toFixed(0)}%</Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${goalProgress}%` }} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Faltan {currency.format(summary.monthly_goal_remaining)} para cumplir la meta del mes.
                </p>
              </div>

              <form onSubmit={handleUpdateMonthlyGoal} className="space-y-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meta del mes</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyGoal}
                    onChange={(event) => setMonthlyGoal(event.target.value)}
                    disabled={goalSaving}
                  />
                </label>
                <Button type="submit" variant="outline" className="w-full" disabled={goalSaving}>
                  {goalSaving ? 'Guardando...' : 'Guardar meta'}
                </Button>
              </form>
            </div>
          </PanelCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FinanceMetric label="Ingresos" value={currency.format(summary.total_income)} icon={<WalletCards className="h-4 w-4" />} accent="text-emerald-600" />
            <FinanceMetric label="Gastos" value={currency.format(summary.expenses)} icon={<ReceiptText className="h-4 w-4" />} accent="text-red-600" />
            <FinanceMetric label="Utilidad" value={currency.format(summary.net_profit)} icon={<TrendingUp className="h-4 w-4" />} accent={summary.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'} />
            <FinanceMetric label="Retiros personales" value={currency.format(summary.personal_withdrawals)} icon={<CreditCard className="h-4 w-4" />} accent="text-amber-700" />
            <FinanceMetric label="Dinero disponible" value={currency.format(summary.available_cash)} icon={<DollarSign className="h-4 w-4" />} accent={summary.available_cash >= 0 ? 'text-cyan-700' : 'text-red-600'} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PanelCard>
          <SectionTitle icon={<WalletCards className="h-5 w-5" />} title="Ingresos" />
          <form onSubmit={handleCreateIncome} className="mt-4 space-y-3">
            <label className="space-y-1">
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

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripcion</span>
              <input
                className={fieldClass}
                value={incomeForm.description}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, description: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
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

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={incomeForm.income_date}
                  onChange={(event) => setIncomeForm((prev) => ({ ...prev, income_date: event.target.value }))}
                  disabled={incomeSaving}
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metodo de pago</span>
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

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente opcional</span>
              <input
                className={fieldClass}
                value={incomeForm.payer}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, payer: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</span>
              <input
                className={fieldClass}
                value={incomeForm.notes}
                onChange={(event) => setIncomeForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={incomeSaving}
              />
            </label>

            <Button type="submit" className="w-full" disabled={incomeSaving}>
              <Plus className="h-4 w-4" />
              {incomeSaving ? 'Guardando...' : 'Agregar ingreso'}
            </Button>
          </form>
        </PanelCard>

        <PanelCard>
          <SectionTitle icon={<ReceiptText className="h-5 w-5" />} title="Gastos" />
          <form onSubmit={handleCreateExpense} className="mt-4 space-y-3">
            <label className="space-y-1">
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

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripcion</span>
              <input
                className={fieldClass}
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
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

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(event) => setExpenseForm((prev) => ({ ...prev, expense_date: event.target.value }))}
                  disabled={expenseSaving}
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metodo de pago</span>
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

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</span>
              <input
                className={fieldClass}
                value={expenseForm.notes}
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={expenseSaving}
              />
            </label>

            <Button type="submit" className="w-full" disabled={expenseSaving}>
              <Plus className="h-4 w-4" />
              {expenseSaving ? 'Guardando...' : 'Agregar gasto'}
            </Button>
          </form>
        </PanelCard>

        <PanelCard>
          <SectionTitle icon={<CreditCard className="h-5 w-5" />} title="Retiros personales" />
          <form onSubmit={handleCreateWithdrawal} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</span>
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={withdrawalForm.amount}
                  onChange={(event) => setWithdrawalForm((prev) => ({ ...prev, amount: event.target.value }))}
                  disabled={withdrawalSaving}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={withdrawalForm.withdrawal_date}
                  onChange={(event) => setWithdrawalForm((prev) => ({ ...prev, withdrawal_date: event.target.value }))}
                  disabled={withdrawalSaving}
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo</span>
              <select
                className={fieldClass}
                value={withdrawalForm.reason}
                onChange={(event) => setWithdrawalForm((prev) => ({ ...prev, reason: event.target.value }))}
                disabled={withdrawalSaving}
              >
                {withdrawalReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Los retiros personales reducen el dinero disponible, pero no se cuentan como gasto del negocio.
            </div>

            <Button type="submit" className="w-full" disabled={withdrawalSaving}>
              <Plus className="h-4 w-4" />
              {withdrawalSaving ? 'Guardando...' : 'Agregar retiro'}
            </Button>
          </form>
        </PanelCard>
      </div>

      <section className="space-y-3">
        <SectionTitle icon={<WalletCards className="h-5 w-5" />} title="Historial" />
        {history.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Los ingresos, gastos y retiros apareceran aqui."
            icon={<WalletCards className="h-5 w-5" />}
          />
        ) : (
          <TableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/35">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripcion</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Monto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo restante</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`} className="border-b last:border-0">
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(entry.movement_date)}</td>
                    <td className="px-4 py-4">
                      <MovementTypeBadge type={entry.type} />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{movementCategoryLabel(entry)}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{entry.description}</div>
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold ${entry.signed_amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {entry.signed_amount >= 0 ? '+' : '-'}
                      {currency.format(entry.amount)}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold">{currency.format(entry.balance_remaining)}</td>
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
                  Se ocultaran ingresos, gastos, retiros e historial anteriores a este momento. Los pedidos y cotizaciones no se borran.
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
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

function MovementTypeBadge({ type }: { type: FinanceHistoryEntry['type'] }) {
  const classes: Record<FinanceHistoryEntry['type'], string> = {
    income: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    expense: 'border-red-300 bg-red-50 text-red-700',
    withdrawal: 'border-amber-300 bg-amber-50 text-amber-700',
  }

  return (
    <Badge variant="outline" className={classes[type]}>
      {movementTypeLabel(type)}
    </Badge>
  )
}

function movementTypeLabel(type: FinanceHistoryEntry['type']) {
  if (type === 'income') return 'Ingreso'
  if (type === 'expense') return 'Gasto'
  return 'Retiro'
}

function movementCategoryLabel(entry: FinanceHistoryEntry) {
  if (entry.type === 'income') return incomeSourceLabel(entry.category)
  if (entry.type === 'expense') return expenseCategoryLabel(entry.category)
  return 'Retiro personal'
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

function incomeSourceLabel(value: string) {
  const legacyLabels: Record<string, string> = {
    cotizaciones: 'Cotizaciones',
    venta_efectivo: 'Ventas locales',
    afiliados_externo: 'Ventas locales',
    marketplace: 'Mercado Libre',
    transferencia: 'Transferencia',
    ajuste: 'Ajuste',
  }
  return incomeSources.find((source) => source.value === value)?.label || legacyLabels[value] || value || 'Otros ingresos'
}

function expenseCategoryLabel(value: string) {
  const legacyLabels: Record<string, string> = {
    materiales: 'Filamento',
    nomina: 'Otros',
    software: 'Otros',
    mantenimiento: 'Otros',
    operacion: 'Otros',
  }
  return expenseCategories.find((category) => category.value === value)?.label || legacyLabels[value] || value || 'Otros'
}

function withdrawalReasonLabel(value: string) {
  return withdrawalReasons.find((reason) => reason.value === value)?.label || value || 'Retiro personal'
}
