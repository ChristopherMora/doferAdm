'use client'

import {
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  Pencil,
  ReceiptText,
  RefreshCw,
  Undo2,
} from 'lucide-react'
import {
  DialogBackdrop,
  DialogHeader,
} from './dialog'
import {
  moneyFormatter,
} from '../_lib/format'
import {
  productDisplayName,
} from '../_lib/products'
import type {
  BazarProduct,
  OfflineProductEntry,
  OfflineSaleEntry,
  Sale,
  SyncConflict,
} from '../_lib/types'

export function OfflineQueueDialog({
  products,
  sales,
  syncing,
  onClose,
  onRetry,
  onCorrectProduct,
  onUndoSale,
}: {
  products: OfflineProductEntry[]
  sales: OfflineSaleEntry[]
  syncing: boolean
  onClose: () => void
  onRetry: () => void
  onCorrectProduct: (product: BazarProduct) => void
  onUndoSale: (sale: Sale) => void
}) {
  return (
    <DialogBackdrop onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader
          eyebrow="Guardado en este dispositivo"
          title="Operaciones sin conexión"
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Los productos se envían primero y después sus ventas. La cola se conserva al cerrar o recargar la página.
          </p>
          <div className="divide-y divide-border border-y border-border">
            {products.map((entry) => (
              <div key={entry.product.id} className="flex items-start gap-3 py-3">
                <PackagePlus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {productDisplayName(entry.product)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.operation === 'update' ? 'Edición de producto' : 'Producto nuevo'}
                    {' · '}
                    {entry.attempts > 0 ? `${entry.attempts} intentos` : 'Pendiente'}
                  </p>
                  {entry.last_error && (
                    <p className="mt-1 text-xs text-red-600">{entry.last_error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onCorrectProduct(entry.product)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Corregir
                </button>
              </div>
            ))}
            {sales.map((entry) => (
              <div key={entry.sale.client_request_id} className="flex items-start gap-3 py-3">
                <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">
                      {entry.sale.items.map((item) => item.product_name).join(', ')}
                    </p>
                    <span className="shrink-0 text-sm font-semibold">
                      {moneyFormatter.format(entry.sale.total)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venta · {(entry.attempts || 0) > 0 ? `${entry.attempts} intentos` : 'Pendiente'}
                  </p>
                  {entry.last_error && (
                    <p className="mt-1 text-xs text-red-600">{entry.last_error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onUndoSale(entry.sale)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium hover:bg-accent"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Deshacer
                </button>
              </div>
            ))}
            {products.length === 0 && sales.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay operaciones pendientes.
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button
            type="button"
            onClick={onRetry}
            disabled={syncing || products.length + sales.length === 0}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Reintentar envío
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}

export function SyncConflictDialog({
  conflicts,
  busy,
  onClose,
  onResolve,
}: {
  conflicts: SyncConflict[]
  busy: boolean
  onClose: () => void
  onResolve: (strategy: 'keep_manual' | 'use_sheet') => void
}) {
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={`${conflicts.length} ${conflicts.length === 1 ? 'diferencia encontrada' : 'diferencias encontradas'}`} title="Resolver inventario" onClose={onClose} />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr><th className="py-2 pr-3">Producto</th><th className="py-2 pr-3 text-right">Stock manual</th><th className="py-2 text-right">Stock Sheets</th></tr></thead>
            <tbody className="divide-y divide-border">{conflicts.map((item) => <tr key={item.product_id}><td className="py-3 pr-3"><p className="font-medium">{item.product_name}</p><p className="text-xs text-muted-foreground">{item.external_id}</p></td><td className="py-3 pr-3 text-right">{item.local_stock}</td><td className="py-3 text-right">{item.sheet_stock}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="grid gap-2 border-t border-border bg-muted/35 p-4 sm:grid-cols-2">
          <button type="button" onClick={() => onResolve('keep_manual')} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 font-semibold hover:bg-accent disabled:opacity-50">
            <PackageCheck className="h-4 w-4" />
            Conservar stock manual
          </button>
          <button type="button" onClick={() => onResolve('use_sheet')} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Usar stock de Sheets
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}
