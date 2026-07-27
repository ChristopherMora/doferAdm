import type {
  DailyStats,
  PaymentMethod,
} from './types'

export const EMPTY_STATS: DailyStats = {
  total: 0,
  products_sold: 0,
  operations: 0,
  average_ticket: 0,
  pending_sync: 0,
  low_stock_products: 0,
  out_of_stock_products: 0,
}

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'other', label: 'Otro' },
]

export const MOVEMENT_OPTIONS = [
  { value: 'inventory_entry', label: 'Entrada de inventario', direction: 1 },
  { value: 'return', label: 'Devolución', direction: 1 },
  { value: 'damaged', label: 'Producto dañado', direction: -1 },
  { value: 'lost', label: 'Pérdida', direction: -1 },
  { value: 'gift', label: 'Regalo', direction: -1 },
  { value: 'sample', label: 'Muestra', direction: -1 },
  { value: 'manual_adjustment', label: 'Ajuste manual', direction: 0 },
] as const

export const AUDIT_LABELS: Record<string, string> = {
  'bazar.created': 'Inició el bazar',
  'bazar.closed': 'Cerró el bazar',
  'cash.daily_cut': 'Registró un corte diario',
  'product.created': 'Creó un producto',
  'product.updated': 'Editó un producto',
  'inventory.adjusted': 'Ajustó inventario',
  'sale.created': 'Registró una venta',
  'sale.cancelled': 'Canceló una venta',
}

export const MAX_SALE_QUANTITY = 999

export const VARIANT_COLORS = [
  '#8B5E3C',
  '#E88AAE',
  '#5B8DEF',
  '#4AAE78',
  '#E4B740',
  '#7B61A8',
]
