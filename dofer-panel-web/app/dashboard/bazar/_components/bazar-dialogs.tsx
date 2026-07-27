'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  FileDown,
  FileText,
  LoaderCircle,
  Store,
  WalletCards,
  WifiOff,
  X,
} from 'lucide-react'
import {
  Metric,
} from './catalog'
import {
  DialogBackdrop,
  DialogHeader,
} from './dialog'
import {
  AUDIT_LABELS,
  PAYMENT_METHODS,
} from '../_lib/constants'
import {
  localDateKey,
  moneyFormatter,
  movementLabel,
  paymentLabel,
} from '../_lib/format'
import {
  downloadDailyReportCSV,
  downloadDailyReportPDF,
} from '../_lib/reports'
import type {
  AuditLog,
  Bazar,
  BazarReport,
  DailyCut,
  DailyStats,
  InventoryMovement,
} from '../_lib/types'

export function NewBazarDialog({
  creating,
  onClose,
  onSubmit,
}: {
  creating: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-bazar-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card text-card-foreground shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Jornada de ventas</p>
            <h2 id="new-bazar-title" className="mt-1 text-xl font-semibold">Iniciar bazar</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nombre del bazar</span>
            <input name="name" required autoFocus placeholder="Ej. Plaza Comercial" className="h-11 w-full rounded-md border border-input bg-background px-3" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Ubicación</span>
            <input name="location" placeholder="Ej. Centro, Querétaro" className="h-11 w-full rounded-md border border-input bg-background px-3" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Método de pago predeterminado</span>
            <select name="default_payment_method" className="h-11 w-full rounded-md border border-input bg-background px-3">
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Efectivo inicial</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                name="opening_cash"
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                defaultValue="0"
                className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
              />
            </div>
          </label>
        </div>

        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button type="submit" disabled={creating} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            Iniciar bazar
          </button>
        </div>
      </form>
    </div>
  )
}

export function CloseBazarDialog({
  bazar,
  stats,
  report,
  reportLoading,
  offlineQueueCount,
  previousCut,
  closing,
  onClose,
  onSubmit,
}: {
  bazar: Bazar
  stats: DailyStats
  report: BazarReport | null
  reportLoading: boolean
  offlineQueueCount: number
  previousCut: DailyCut | null
  closing: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [countedCash, setCountedCash] = useState('')
  const [openingCash, setOpeningCash] = useState(
    String(previousCut?.closing_cash ?? bazar.opening_cash),
  )
  const cashSales =
    report?.payment_methods.find((item) => item.method === 'cash')?.total || 0
  const expectedCash = Number(openingCash || 0) + cashSales
  const difference = countedCash === '' ? null : Number(countedCash) - expectedCash
  const alreadyClosedToday = previousCut?.business_date === localDateKey()

  return (
    <DialogBackdrop onClose={onClose}>
      <form onSubmit={onSubmit} role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={bazar.name} title="Corte del día" onClose={onClose} />
        <div className="grid grid-cols-2 border-b border-border">
          <Metric label="Efectivo de inicio" value={moneyFormatter.format(Number(openingCash || 0))} />
          <Metric label="Ventas totales" value={moneyFormatter.format(stats.total)} />
        </div>
        <div className="space-y-5 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Fecha del corte</span>
            <input
              name="date"
              type="date"
              value={localDateKey()}
              readOnly
              className="h-11 w-full rounded-md border border-input bg-muted px-3"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Efectivo al iniciar el día</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                name="opening_cash"
                type="number"
                required
                min="0"
                max="999999999"
                step="0.01"
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
              />
            </div>
          </label>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Ventas por método</h3>
            {reportLoading ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Calculando corte...
              </p>
            ) : (
              <div className="divide-y divide-border border-y border-border">
                {(report?.payment_methods || []).map((item) => (
                  <div key={item.method} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{paymentLabel(item.method)}</span>
                    <strong>{moneyFormatter.format(item.total)}</strong>
                  </div>
                ))}
                {(report?.payment_methods || []).length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">Sin ventas registradas.</p>
                )}
              </div>
            )}
          </section>
          {offlineQueueCount > 0 && (
            <div className="flex gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              Envía las ventas pendientes antes del corte.
            </div>
          )}
          {alreadyClosedToday && (
            <div className="flex gap-2 border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              El corte de hoy ya fue registrado.
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Efectivo contado en caja</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                name="closing_cash"
                type="number"
                required
                min="0"
                max="999999999"
                step="0.01"
                autoFocus
                value={countedCash}
                onChange={(event) => setCountedCash(event.target.value)}
                className="h-12 w-full rounded-md border border-input bg-background pl-7 pr-3 text-lg font-semibold"
              />
            </div>
          </label>
          <div className="grid grid-cols-2 border-y border-border">
            <Metric label="Efectivo esperado" value={moneyFormatter.format(expectedCash)} />
            <Metric
              label="Diferencia"
              value={difference === null ? 'Pendiente' : moneyFormatter.format(difference)}
            />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Notas del corte</span>
            <textarea name="notes" rows={3} maxLength={500} className="w-full resize-none rounded-md border border-input bg-background p-3" />
          </label>
        </div>
        <div className="sticky bottom-0 z-10 border-t border-border bg-muted/95 px-5 py-4 backdrop-blur">
          <button type="submit" disabled={closing || reportLoading || offlineQueueCount > 0 || alreadyClosedToday} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {closing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
            Guardar corte del día
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}

export function FinalizeBazarDialog({
  bazar,
  cuts,
  report,
  todayOperations,
  offlineQueueCount,
  closing,
  onClose,
  onSubmit,
}: {
  bazar: Bazar
  cuts: DailyCut[]
  report: BazarReport | null
  todayOperations: number
  offlineQueueCount: number
  closing: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const todayCut = cuts.find((cut) => cut.business_date === localDateKey())
  const needsTodayCut = todayOperations > 0 && !todayCut
  const canFinalize = cuts.length > 0 && !needsTodayCut
  const totalExpected = cuts.reduce((total, cut) => total + cut.expected_cash, 0)
  const totalCounted = cuts.reduce((total, cut) => total + cut.closing_cash, 0)
  const totalDifference = cuts.reduce((total, cut) => total + cut.cash_difference, 0)

  return (
    <DialogBackdrop onClose={onClose}>
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader eyebrow={bazar.name} title="Finalizar bazar" onClose={onClose} />
        <div className="grid grid-cols-2 border-b border-border">
          <Metric label="Días con corte" value={String(cuts.length)} />
          <Metric label="Ventas del evento" value={moneyFormatter.format(report?.total || 0)} />
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="divide-y divide-border border-y border-border">
            {cuts.map((cut) => (
              <div key={cut.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {new Date(`${cut.business_date}T12:00:00`).toLocaleDateString('es-MX', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esperado {moneyFormatter.format(cut.expected_cash)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{moneyFormatter.format(cut.closing_cash)}</p>
                  <p className={cut.cash_difference === 0 ? 'text-xs text-muted-foreground' : 'text-xs text-amber-700'}>
                    Diferencia {moneyFormatter.format(cut.cash_difference)}
                  </p>
                </div>
              </div>
            ))}
            {cuts.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Aún no hay cortes diarios.</p>
            )}
          </div>

          <div className="grid grid-cols-3 border-y border-border">
            <Metric label="Esperado" value={moneyFormatter.format(totalExpected)} />
            <Metric label="Contado" value={moneyFormatter.format(totalCounted)} />
            <Metric label="Diferencia" value={moneyFormatter.format(totalDifference)} />
          </div>

          {!canFinalize && (
            <div className="flex gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              {needsTodayCut
                ? 'Registra primero el corte del día de hoy.'
                : 'Registra al menos un corte antes de finalizar.'}
            </div>
          )}
          {offlineQueueCount > 0 && (
            <div className="flex gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              Envía todas las operaciones pendientes antes de finalizar.
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Notas finales</span>
            <textarea
              name="notes"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-md border border-input bg-background p-3"
            />
          </label>
        </div>
        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button
            type="submit"
            disabled={closing || !canFinalize || offlineQueueCount > 0}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {closing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            Cerrar definitivamente el bazar
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}

export function ReportDialog({
  report,
  movements,
  auditLogs,
  loading,
  date,
  onDateChange,
  onClose,
}: {
  report: BazarReport | null
  movements: InventoryMovement[]
  auditLogs: AuditLog[]
  loading: boolean
  date: string
  onDateChange: (date: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'summary' | 'products' | 'movements' | 'audit'>('summary')
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader
          eyebrow={report?.bazar?.name || 'Ventas del día'}
          title={report?.bazar?.status === 'closed' ? 'Resumen final' : 'Reporte diario'}
          onClose={onClose}
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Día</span>
            <input
              type="date"
              value={date}
              max={localDateKey()}
              disabled={loading}
              onChange={(event) => onDateChange(event.target.value || localDateKey())}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
            />
          </label>
          {date !== localDateKey() && (
            <button
              type="button"
              onClick={() => onDateChange(localDateKey())}
              disabled={loading}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Ver hoy
            </button>
          )}
        </div>
        <div className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {([
            ['summary', 'Resumen'],
            ['products', 'Productos'],
            ['movements', 'Inventario'],
            ['audit', 'Auditoría'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium ${tab === value ? 'bg-foreground text-background' : 'hover:bg-accent'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading || !report ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Generando reporte...
            </div>
          ) : tab === 'summary' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 border-y border-border md:grid-cols-4">
                <Metric label="Vendido" value={moneyFormatter.format(report.total)} emphasized />
                <Metric label="Operaciones" value={String(report.operations)} />
                <Metric label="Unidades" value={String(report.products_sold)} />
                <Metric label="Ticket promedio" value={moneyFormatter.format(report.average_ticket)} />
              </div>
              <section>
                <h3 className="mb-2 font-semibold">Métodos de pago</h3>
                <div className="divide-y divide-border border-y border-border">
                  {report.payment_methods.map((item) => (
                    <div key={item.method} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>{paymentLabel(item.method)}</span>
                      <span className="text-right"><span className="text-muted-foreground">{item.operations} op. · </span><strong>{moneyFormatter.format(item.total)}</strong></span>
                    </div>
                  ))}
                  {report.payment_methods.length === 0 && <p className="py-4 text-sm text-muted-foreground">Sin ventas registradas.</p>}
                </div>
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Corte de efectivo</h3>
                <div className="grid grid-cols-1 border-y border-border sm:grid-cols-3">
                  <Metric label="Efectivo esperado" value={moneyFormatter.format(report.expected_cash)} />
                  <Metric label="Efectivo contado" value={report.closing_cash === undefined ? 'Pendiente' : moneyFormatter.format(report.closing_cash)} />
                  <Metric label="Diferencia" value={report.cash_difference === undefined ? 'Pendiente' : moneyFormatter.format(report.cash_difference)} />
                </div>
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Por vendedor</h3>
                <div className="divide-y divide-border border-y border-border">
                  {report.sellers.map((item) => (
                    <div key={item.seller_name} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="truncate">{item.seller_name}</span>
                      <span className="shrink-0">{item.quantity} uds. · <strong>{moneyFormatter.format(item.total)}</strong></span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : tab === 'products' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Producto</th><th className="py-2 pr-3 text-right">Unidades</th><th className="py-2 text-right">Total</th></tr></thead>
                <tbody className="divide-y divide-border">{report.products.map((item) => <tr key={item.product_id}><td className="py-3 pr-3 text-muted-foreground">{item.external_id}</td><td className="py-3 pr-3 font-medium">{item.product_name}</td><td className="py-3 pr-3 text-right">{item.quantity}</td><td className="py-3 text-right font-semibold">{moneyFormatter.format(item.total)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : tab === 'movements' ? (
            <ActivityList
              empty="No hay movimientos de inventario."
              items={movements.map((item) => ({
                id: item.id,
                title: `${movementLabel(item.movement_type)} · ${item.product_name}`,
                detail: `${item.quantity > 0 ? '+' : ''}${item.quantity} · ${item.stock_before} → ${item.stock_after} · ${item.actor_name}`,
                date: item.created_at,
              }))}
            />
          ) : (
            <ActivityList
              empty="No hay acciones registradas."
              items={auditLogs.map((item) => ({
                id: item.id,
                title: AUDIT_LABELS[item.action] || item.action,
                detail: item.actor_name,
                date: item.created_at,
              }))}
            />
          )}
        </div>
        {report && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-muted/35 px-5 py-3">
            <button type="button" onClick={() => downloadDailyReportCSV(report)} className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
              <FileDown className="h-4 w-4" />
              CSV
            </button>
            <button type="button" onClick={() => void downloadDailyReportPDF(report)} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>
    </DialogBackdrop>
  )
}

export function ActivityList({
  items,
  empty,
}: {
  items: Array<{ id: string; title: string; detail: string; date: string }>
  empty: string
}) {
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground">{new Date(item.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
        </div>
      ))}
    </div>
  )
}
