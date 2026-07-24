'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudOff,
  FileDown,
  FileText,
  ImageOff,
  Layers3,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  PackageCheck,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  WalletCards,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface BazarProduct {
  id: string
  external_id: string
  name: string
  category: string
  price: number
  stock: number
  track_stock: boolean
  image_url?: string
  active: boolean
  source?: 'manual' | 'sheets' | 'catalog'
  stock_sync_policy?: 'manual' | 'sheets'
}

interface Bazar {
  id: string
  name: string
  location?: string
  status: 'active' | 'closed' | 'archived'
  default_payment_method: PaymentMethod
  starts_at: string
  ends_at?: string
  opening_cash: number
  expected_cash?: number
  closing_cash?: number
  cash_difference?: number
  closing_notes?: string
}

interface SaleItem {
  product_id: string
  product_external_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
  stock_before: number
  stock_after: number
}

interface Sale {
  id: string
  external_id: string
  client_request_id: string
  bazar_id: string
  bazar_name: string
  seller_name: string
  total: number
  payment_method: PaymentMethod
  status: 'completed' | 'cancelled'
  sync_status: 'pending' | 'synced' | 'error'
  sync_error?: string
  created_at: string
  items: SaleItem[]
}

interface DailyStats {
  total: number
  products_sold: number
  operations: number
  average_ticket: number
  last_sale_at?: string
  pending_sync: number
  low_stock_products: number
  out_of_stock_products: number
}

interface SyncStatus {
  configured: boolean
  status: 'synced' | 'pending' | 'error' | 'not_configured'
  pending_sales: number
  failed_sales: number
  last_product_sync?: string
  last_sale_sync?: string
  last_error?: string
  configuration_message?: string
}

interface PaymentSummary {
  method: PaymentMethod
  operations: number
  total: number
}

interface ProductSummary {
  product_id: string
  external_id: string
  product_name: string
  quantity: number
  total: number
}

interface SellerSummary {
  seller_name: string
  operations: number
  quantity: number
  total: number
}

interface BazarReport {
  bazar?: Bazar
  date: string
  from: string
  to: string
  total: number
  products_sold: number
  operations: number
  average_ticket: number
  cancelled_sales: number
  payment_methods: PaymentSummary[]
  products: ProductSummary[]
  sellers: SellerSummary[]
  expected_cash: number
  closing_cash?: number
  cash_difference?: number
}

interface InventoryMovement {
  id: string
  product_id: string
  product_name: string
  bazar_id?: string
  bazar_name?: string
  movement_type: string
  quantity: number
  stock_before: number
  stock_after: number
  reason?: string
  actor_name: string
  created_at: string
}

interface AuditLog {
  id: string
  actor_name: string
  action: string
  entity_type: string
  details: Record<string, unknown>
  created_at: string
}

interface SyncConflict {
  product_id: string
  external_id: string
  product_name: string
  local_stock: number
  sheet_stock: number
  local_price: number
  sheet_price: number
}

interface SalePayload {
  client_request_id: string
  bazar_id: string
  items: Array<{ product_id: string; quantity: number }>
  payment_method: PaymentMethod
}

interface QuickSaleInput {
  product: BazarProduct | null
  name: string
  category: string
  price: number
  quantity: number
  paymentMethod: PaymentMethod
}

interface OfflineSaleEntry {
  payload: SalePayload
  sale: Sale
}

interface BazarCache {
  products: BazarProduct[]
  bazaars: Bazar[]
  currentUser: CurrentUser
  syncStatus: SyncStatus | null
  savedAt: string
}

interface CurrentUser {
  full_name: string
  email: string
  role: string
  organization_role?: string
}

interface SaleResponse {
  sale: Sale
  duplicated: boolean
}

type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercado_pago' | 'other'
type StockFilter = 'all' | 'available' | 'low' | 'out' | 'inactive'

const EMPTY_STATS: DailyStats = {
  total: 0,
  products_sold: 0,
  operations: 0,
  average_ticket: 0,
  pending_sync: 0,
  low_stock_products: 0,
  out_of_stock_products: 0,
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'other', label: 'Otro' },
]

const OFFLINE_SALES_KEY = 'dofer-bazar-offline-sales'
const BAZAR_CACHE_KEY = 'dofer-bazar-cache'

const MOVEMENT_OPTIONS = [
  { value: 'inventory_entry', label: 'Entrada de inventario', direction: 1 },
  { value: 'return', label: 'Devolución', direction: 1 },
  { value: 'damaged', label: 'Producto dañado', direction: -1 },
  { value: 'lost', label: 'Pérdida', direction: -1 },
  { value: 'gift', label: 'Regalo', direction: -1 },
  { value: 'sample', label: 'Muestra', direction: -1 },
  { value: 'manual_adjustment', label: 'Ajuste manual', direction: 0 },
] as const

const AUDIT_LABELS: Record<string, string> = {
  'bazar.created': 'Inició el bazar',
  'bazar.closed': 'Cerró el bazar',
  'product.created': 'Creó un producto',
  'product.updated': 'Editó un producto',
  'inventory.adjusted': 'Ajustó inventario',
  'sale.created': 'Registró una venta',
  'sale.cancelled': 'Canceló una venta',
}

const MAX_SALE_QUANTITY = 999

function productTracksStock(product: BazarProduct) {
  return product.track_stock !== false
}

function productSaleLimit(product: BazarProduct) {
  return productTracksStock(product) ? product.stock : MAX_SALE_QUANTITY
}

function normalizeProductLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
}

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: 'numeric',
  minute: '2-digit',
})

function readOfflineSales(): OfflineSaleEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeOfflineSales(entries: OfflineSaleEntry[]) {
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

function readBazarCache(): BazarCache | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(BAZAR_CACHE_KEY) || 'null') as BazarCache | null
  } catch {
    return null
  }
}

function writeBazarCache(cache: BazarCache) {
  try {
    localStorage.setItem(BAZAR_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // La cola de ventas tiene prioridad sobre la caché del catálogo.
  }
}

function applyOfflineStock(products: BazarProduct[]) {
  const queuedQuantities = new Map<string, number>()
  for (const entry of readOfflineSales()) {
    for (const item of entry.payload.items) {
      queuedQuantities.set(
        item.product_id,
        (queuedQuantities.get(item.product_id) || 0) + item.quantity,
      )
    }
  }
  return products.map((product) =>
    productTracksStock(product)
      ? {
          ...product,
          stock: Math.max(0, product.stock - (queuedQuantities.get(product.id) || 0)),
        }
      : product,
  )
}

function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  )
}

async function imageFileToDataURL(file: File | null): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona una imagen válida.')
  }

  const objectURL = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = objectURL
    })
    const maxSide = 720
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.78)
    if (result.length > 900_000) {
      throw new Error('La imagen sigue siendo demasiado grande.')
    }
    return result
  } finally {
    URL.revokeObjectURL(objectURL)
  }
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""')
  return `"${text}"`
}

function downloadDailyReportCSV(report: BazarReport) {
  const rows: Array<Array<string | number>> = [
    ['Reporte de bazar', report.bazar?.name || 'Todos los bazares'],
    ['Fecha', report.date],
    ['Total', report.total],
    ['Operaciones', report.operations],
    ['Productos vendidos', report.products_sold],
    [],
    ['Productos'],
    ['SKU', 'Producto', 'Cantidad', 'Total'],
    ...report.products.map((item) => [
      item.external_id,
      item.product_name,
      item.quantity,
      item.total,
    ]),
    [],
    ['Métodos de pago'],
    ['Método', 'Operaciones', 'Total'],
    ...report.payment_methods.map((item) => [
      paymentLabel(item.method),
      item.operations,
      item.total,
    ]),
    [],
    ['Vendedores'],
    ['Vendedor', 'Operaciones', 'Unidades', 'Total'],
    ...report.sellers.map((item) => [
      item.seller_name,
      item.operations,
      item.quantity,
      item.total,
    ]),
]

  const content = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `bazar-${report.date}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function downloadDailyReportPDF(report: BazarReport) {
  const document = new jsPDF()
  document.setFontSize(18)
  document.text('Reporte diario de bazar', 14, 18)
  document.setFontSize(10)
  document.text(`${report.bazar?.name || 'Todos los bazares'} · ${report.date}`, 14, 25)
  document.text(`Total: ${moneyFormatter.format(report.total)}`, 14, 33)
  document.text(`Operaciones: ${report.operations} · Unidades: ${report.products_sold}`, 14, 39)
  autoTable(document, {
    startY: 46,
    head: [['SKU', 'Producto', 'Cantidad', 'Total']],
    body: report.products.map((item) => [
      item.external_id,
      item.product_name,
      String(item.quantity),
      moneyFormatter.format(item.total),
    ]),
    styles: { fontSize: 8 },
  })
  const finalY = (document as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 60
  autoTable(document, {
    startY: finalY + 8,
    head: [['Método', 'Operaciones', 'Total']],
    body: report.payment_methods.map((item) => [
      paymentLabel(item.method),
      String(item.operations),
      moneyFormatter.format(item.total),
    ]),
    styles: { fontSize: 8 },
  })
  document.save(`bazar-${report.date}.pdf`)
}

function receiptText(sale: Sale) {
  const lines = sale.items.map(
    (item) => `${item.quantity} x ${item.product_name} - ${moneyFormatter.format(item.total)}`,
  )
  return [
    'DOFER - Venta de bazar',
    sale.bazar_name,
    new Date(sale.created_at).toLocaleString('es-MX'),
    '',
    ...lines,
    '',
    `Total: ${moneyFormatter.format(sale.total)}`,
    `Pago: ${paymentLabel(sale.payment_method)}`,
    `Folio: ${sale.external_id}`,
  ].join('\n')
}

function printReceipt(sale: Sale) {
  const popup = window.open('', '_blank', 'width=420,height=720')
  if (!popup) return
  const items = sale.items
    .map(
      (item) =>
        `<tr><td>${item.quantity} x ${escapeHTML(item.product_name)}</td><td>${moneyFormatter.format(item.total)}</td></tr>`,
    )
    .join('')
  popup.document.write(`<!doctype html><html><head><title>${escapeHTML(sale.external_id)}</title>
    <style>body{font-family:Arial,sans-serif;max-width:320px;margin:24px auto;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}.total{font-size:20px;font-weight:700;text-align:right;margin-top:16px}@media print{button{display:none}}</style>
    </head><body><h1>DOFER · Venta de bazar</h1><p>${escapeHTML(sale.bazar_name)}<br>${new Date(sale.created_at).toLocaleString('es-MX')}</p><table>${items}</table><p class="total">${moneyFormatter.format(sale.total)}</p><p>${escapeHTML(paymentLabel(sale.payment_method))}<br>${escapeHTML(sale.external_id)}</p><button onclick="window.print()">Imprimir</button></body></html>`)
  popup.document.close()
  popup.focus()
}

function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character]
  })
}

export default function BazarSalesPage() {
  const [products, setProducts] = useState<BazarProduct[]>([])
  const [bazaars, setBazaars] = useState<Bazar[]>([])
  const [activeBazarID, setActiveBazarID] = useState('')
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState<DailyStats>(EMPTY_STATS)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [sellingProducts, setSellingProducts] = useState<Set<string>>(new Set())
  const [quantityProduct, setQuantityProduct] = useState<BazarProduct | null>(null)
  const [quantity, setQuantity] = useState(2)
  const [confirmation, setConfirmation] = useState<Sale | null>(null)
  const [showNewBazar, setShowNewBazar] = useState(false)
  const [creatingBazar, setCreatingBazar] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [showQuickSale, setShowQuickSale] = useState(false)
  const [quickSaleBusy, setQuickSaleBusy] = useState(false)
  const [editingProduct, setEditingProduct] = useState<BazarProduct | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<BazarProduct | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [showCloseBazar, setShowCloseBazar] = useState(false)
  const [closingBazar, setClosingBazar] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [report, setReport] = useState<BazarReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([])
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [flushingOffline, setFlushingOffline] = useState(false)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushingOfflineRef = useRef(false)

  const activeBazar = useMemo(
    () => bazaars.find((item) => item.id === activeBazarID),
    [activeBazarID, bazaars],
  )
  const canSell = ['admin', 'operator'].includes(
    currentUser?.organization_role || currentUser?.role || '',
  )
  const cartProducts = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] || 0) > 0)
        .map((product) => ({ product, quantity: cart[product.id] })),
    [cart, products],
  )
  const quickSaleProducts = useMemo(() => {
    const recentPosition = new Map<string, number>()
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!recentPosition.has(item.product_id)) {
          recentPosition.set(item.product_id, recentPosition.size)
        }
      }
    }
    return [...products].sort((first, second) => {
      const firstPosition = recentPosition.get(first.id) ?? Number.MAX_SAFE_INTEGER
      const secondPosition = recentPosition.get(second.id) ?? Number.MAX_SAFE_INTEGER
      if (firstPosition !== secondPosition) return firstPosition - secondPosition
      return first.name.localeCompare(second.name, 'es')
    })
  }, [products, sales])
  const cartUnits = useMemo(
    () => cartProducts.reduce((total, item) => total + item.quantity, 0),
    [cartProducts],
  )
  const cartTotal = useMemo(
    () => cartProducts.reduce((total, item) => total + item.product.price * item.quantity, 0),
    [cartProducts],
  )

  const categories = useMemo(() => {
    const values = new Set(
      products.map((product) => product.category.trim()).filter(Boolean),
    )
    return ['Todos', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'es'))]
  }, [products])

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLocaleLowerCase('es').includes(normalizedQuery) ||
        product.external_id.toLocaleLowerCase('es').includes(normalizedQuery) ||
        product.category.toLocaleLowerCase('es').includes(normalizedQuery)
      const matchesCategory = category === 'Todos' || product.category === category
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'available' && (!productTracksStock(product) || product.stock > 0)) ||
        (stockFilter === 'low' && productTracksStock(product) && product.stock > 0 && product.stock <= 2) ||
        (stockFilter === 'out' && productTracksStock(product) && product.stock === 0) ||
        stockFilter === 'inactive'
      const matchesStatus = stockFilter === 'inactive' ? !product.active : product.active
      return matchesStatus && matchesQuery && matchesCategory && matchesStock
    })
  }, [products, category, query, stockFilter])

  const loadProducts = useCallback(async () => {
    const response = await apiClient.get<{ products: BazarProduct[] }>('/bazar/products')
    const serverProducts = response.products || []
    const nextProducts = applyOfflineStock(serverProducts)
    setProducts(nextProducts)
    return serverProducts
  }, [])

  const loadActivity = useCallback(async (bazarID: string) => {
    if (!bazarID) {
      setSales([])
      setStats(EMPTY_STATS)
      return
    }
    const [statsResponse, salesResponse] = await Promise.all([
      apiClient.get<DailyStats>('/bazar/stats', { params: { bazar_id: bazarID } }),
      apiClient.get<{ sales: Sale[] }>('/bazar/sales', {
        params: { bazar_id: bazarID, limit: 12 },
      }),
    ])
    const queuedSales = readOfflineSales()
      .filter((entry) => entry.payload.bazar_id === bazarID)
      .map((entry) => entry.sale)
    const queuedTotal = queuedSales.reduce((total, sale) => total + sale.total, 0)
    const queuedUnits = queuedSales.reduce(
      (total, sale) => total + sale.items.reduce((sum, item) => sum + item.quantity, 0),
      0,
    )
    const queuedOperations = queuedSales.length
    const nextStats = {
      ...statsResponse,
      total: statsResponse.total + queuedTotal,
      products_sold: statsResponse.products_sold + queuedUnits,
      operations: statsResponse.operations + queuedOperations,
      pending_sync: statsResponse.pending_sync + queuedOperations,
      average_ticket:
        statsResponse.operations + queuedOperations > 0
          ? (statsResponse.total + queuedTotal) / (statsResponse.operations + queuedOperations)
          : 0,
      last_sale_at: queuedSales[0]?.created_at || statsResponse.last_sale_at,
    }
    setStats(nextStats)
    setSales([
      ...queuedSales,
      ...(salesResponse.sales || []).filter(
        (sale) => !queuedSales.some((queued) => queued.client_request_id === sale.client_request_id),
      ),
    ].slice(0, 12))
  }, [])

  const loadSyncStatus = useCallback(async () => {
    const response = await apiClient.get<SyncStatus>('/bazar/sync/status')
    setSyncStatus(response)
    return response
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bazarResponse, userResponse, currentSyncStatus] = await Promise.all([
          apiClient.get<{ bazaars: Bazar[] }>('/bazar/bazaars'),
          apiClient.get<CurrentUser>('/auth/me'),
          loadSyncStatus(),
        ])
        if (cancelled) return

        const availableBazaars = bazarResponse.bazaars || []
        setBazaars(availableBazaars)
        setCurrentUser(userResponse)

        const storedBazarID = localStorage.getItem('dofer-active-bazar-id')
        const selected =
          availableBazaars.find(
            (item) => item.id === storedBazarID && item.status === 'active',
          ) ||
          availableBazaars.find((item) => item.status === 'active')
        if (selected) {
          setActiveBazarID(selected.id)
          setPaymentMethod(selected.default_payment_method)
        }

        const lastSync = currentSyncStatus.last_product_sync
          ? new Date(currentSyncStatus.last_product_sync).getTime()
          : 0
        const needsRefresh =
          currentSyncStatus.configured && Date.now() - lastSync > 5 * 60 * 1000
        if (needsRefresh && ['admin', 'operator'].includes(
          userResponse.organization_role || userResponse.role,
        )) {
          setSyncing(true)
          try {
            const conflictResponse = await apiClient.get<{ conflicts: SyncConflict[] }>('/bazar/sync/conflicts')
            if ((conflictResponse.conflicts || []).length > 0) {
              setSyncConflicts(conflictResponse.conflicts)
            } else {
              await apiClient.post('/bazar/sync', { conflict_strategy: '' })
            }
          } catch (syncError) {
            if (!cancelled) {
              setError(getErrorMessage(syncError, 'No se pudo sincronizar Google Sheets.'))
            }
          } finally {
            if (!cancelled) setSyncing(false)
          }
        }

        const loadedProducts = await loadProducts()
        const refreshedStatus = !cancelled ? await loadSyncStatus() : currentSyncStatus
        if (!cancelled) {
          writeBazarCache({
            products: loadedProducts,
            bazaars: availableBazaars,
            currentUser: userResponse,
            syncStatus: refreshedStatus,
            savedAt: new Date().toISOString(),
          })
          setOfflineQueueCount(readOfflineSales().length)
        }
      } catch (loadError) {
        if (!cancelled) {
          const cached = readBazarCache()
          if (cached && isNetworkError(loadError)) {
            setProducts(applyOfflineStock(cached.products))
            setBazaars(cached.bazaars)
            setCurrentUser(cached.currentUser)
            setSyncStatus(cached.syncStatus)
            setOfflineQueueCount(readOfflineSales().length)
            const storedBazarID = localStorage.getItem('dofer-active-bazar-id')
            const selected =
              cached.bazaars.find(
                (item) => item.id === storedBazarID && item.status === 'active',
              ) || cached.bazaars.find((item) => item.status === 'active')
            if (selected) {
              setActiveBazarID(selected.id)
              setPaymentMethod(selected.default_payment_method)
            }
          } else {
            setError(getErrorMessage(loadError, 'No se pudo cargar Ventas del bazar.'))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    }
  }, [loadProducts, loadSyncStatus])

  useEffect(() => {
    if (!activeBazarID) return
    localStorage.setItem('dofer-active-bazar-id', activeBazarID)

    const activityTimer = window.setTimeout(() => {
      void loadActivity(activeBazarID).catch((activityError) => {
        if (isNetworkError(activityError)) {
          const queuedSales = readOfflineSales()
            .filter((entry) => entry.payload.bazar_id === activeBazarID)
            .map((entry) => entry.sale)
          if (queuedSales.length > 0) {
            const total = queuedSales.reduce((sum, sale) => sum + sale.total, 0)
            const units = queuedSales.reduce(
              (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
              0,
            )
            setSales(queuedSales)
            setStats({
              ...EMPTY_STATS,
              total,
              products_sold: units,
              operations: queuedSales.length,
              average_ticket: total / queuedSales.length,
              pending_sync: queuedSales.length,
              last_sale_at: queuedSales[0].created_at,
            })
          }
          return
        }
        setError(getErrorMessage(activityError, 'No se pudo cargar la actividad del día.'))
      })
    }, 0)
    return () => window.clearTimeout(activityTimer)
  }, [activeBazarID, loadActivity])

  const performSync = async (conflictStrategy?: 'keep_manual' | 'use_sheet') => {
    setSyncing(true)
    setError(null)
    try {
      await apiClient.post('/bazar/sync', {
        conflict_strategy: conflictStrategy || '',
      })
      setSyncConflicts([])
      await Promise.all([loadProducts(), loadSyncStatus(), loadActivity(activeBazarID)])
    } catch (syncError) {
      setError(getErrorMessage(syncError, 'No se pudo sincronizar Google Sheets.'))
      await loadSyncStatus().catch(() => undefined)
    } finally {
      setSyncing(false)
    }
  }

  const syncNow = async () => {
    if (!canSell || syncing) return
    setSyncing(true)
    setError(null)
    try {
      const response = await apiClient.get<{ conflicts: SyncConflict[] }>('/bazar/sync/conflicts')
      if ((response.conflicts || []).length > 0) {
        setSyncConflicts(response.conflicts)
        return
      }
    } catch (conflictError) {
      setError(getErrorMessage(conflictError, 'No se pudo comparar el inventario.'))
      setSyncing(false)
      return
    }
    setSyncing(false)
    await performSync()
  }

  const showSaleConfirmation = (sale: Sale) => {
    setConfirmation(sale)
    setQuantityProduct(null)
    if ('vibrate' in navigator) navigator.vibrate(70)
    if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    confirmationTimer.current = setTimeout(() => setConfirmation(null), 9000)
  }

  const submitSale = async (
    requestedItems: Array<{ product: BazarProduct; quantity: number }>,
    method: PaymentMethod,
  ) => {
    if (!activeBazar || !canSell || requestedItems.length === 0) return null
    for (const item of requestedItems) {
      if (item.quantity <= 0 || item.quantity > MAX_SALE_QUANTITY) {
        setError('La cantidad debe estar entre 1 y 999.')
        return null
      }
      if (productTracksStock(item.product) && item.quantity > item.product.stock) {
        setError(`Solo hay ${item.product.stock} unidades disponibles de ${item.product.name}.`)
        return null
      }
    }

    const payload: SalePayload = {
      client_request_id: crypto.randomUUID(),
      bazar_id: activeBazar.id,
      items: requestedItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
      payment_method: method,
    }

    setError(null)
    try {
      const response = await apiClient.post<SaleResponse>('/bazar/sales', payload)
      const sale = response.sale
      const stockByProduct = new Map(
        sale.items.map((item) => [item.product_id, item.stock_after]),
      )
      setProducts((current) =>
        current.map((product) =>
          stockByProduct.has(product.id)
            ? { ...product, stock: stockByProduct.get(product.id) ?? product.stock }
            : product,
        ),
      )
      setSales((current) => [sale, ...current.filter((item) => item.id !== sale.id)].slice(0, 12))
      showSaleConfirmation(sale)
      await Promise.all([loadActivity(activeBazar.id), loadSyncStatus()]).catch((refreshError) => {
        if (!isNetworkError(refreshError)) {
          setError(getErrorMessage(refreshError, 'La venta se registró, pero no se pudo actualizar el resumen.'))
        }
      })
      return sale
    } catch (saleError) {
      if (!isNetworkError(saleError)) {
        setError(getErrorMessage(saleError, 'No se pudo registrar la venta.'))
        return null
      }

      const createdAt = new Date().toISOString()
      const localSale: Sale = {
        id: `offline-${payload.client_request_id}`,
        external_id: `PEND-${payload.client_request_id.slice(0, 8).toUpperCase()}`,
        client_request_id: payload.client_request_id,
        bazar_id: activeBazar.id,
        bazar_name: activeBazar.name,
        seller_name: currentUser?.full_name || currentUser?.email || 'Vendedor',
        total: requestedItems.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0,
        ),
        payment_method: method,
        status: 'completed',
        sync_status: 'pending',
        created_at: createdAt,
        items: requestedItems.map((item) => ({
          product_id: item.product.id,
          product_external_id: item.product.external_id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
          total: item.product.price * item.quantity,
          stock_before: item.product.stock,
          stock_after: productTracksStock(item.product)
            ? item.product.stock - item.quantity
            : item.product.stock,
        })),
      }
      const queued = [{ payload, sale: localSale }, ...readOfflineSales()]
      if (!writeOfflineSales(queued)) {
        setError('No hay espacio disponible en el dispositivo para guardar la venta sin conexión.')
        return null
      }
      setOfflineQueueCount(queued.length)
      setProducts((current) =>
        current.map((product) => {
          const sold = requestedItems.find((item) => item.product.id === product.id)
          return sold && productTracksStock(product)
            ? { ...product, stock: product.stock - sold.quantity }
            : product
        }),
      )
      setSales((current) => [localSale, ...current].slice(0, 12))
      setStats((current) => {
        const units = requestedItems.reduce((total, item) => total + item.quantity, 0)
        const operations = current.operations + 1
        const total = current.total + localSale.total
        return {
          ...current,
          total,
          products_sold: current.products_sold + units,
          operations,
          average_ticket: total / operations,
          pending_sync: current.pending_sync + 1,
          last_sale_at: createdAt,
        }
      })
      showSaleConfirmation(localSale)
      return localSale
    }
  }

  const registerSale = async (product: BazarProduct, requestedQuantity: number) => {
    if (sellingProducts.has(product.id)) return
    setSellingProducts((current) => new Set(current).add(product.id))
    try {
      await submitSale([{ product, quantity: requestedQuantity }], paymentMethod)
    } finally {
      setSellingProducts((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
    }
  }

  const updateCartQuantity = (product: BazarProduct, nextQuantity: number) => {
    setCart((current) => {
      const next = { ...current }
      if (nextQuantity <= 0) delete next[product.id]
      else next[product.id] = Math.min(productSaleLimit(product), nextQuantity)
      return next
    })
  }

  const addToCart = (product: BazarProduct) => {
    setCart((current) => ({
      ...current,
      [product.id]: Math.min(productSaleLimit(product), (current[product.id] || 0) + 1),
    }))
  }

  const submitCartSale = async () => {
    if (cartBusy) return
    setCartBusy(true)
    try {
      const sale = await submitSale(cartProducts, paymentMethod)
      if (sale) {
        setCart({})
        setShowCart(false)
      }
    } finally {
      setCartBusy(false)
    }
  }

  const submitQuickSale = async (input: QuickSaleInput) => {
    if (quickSaleBusy || !activeBazar) return
    setQuickSaleBusy(true)
    setError(null)
    try {
      let product = input.product
      if (!product) {
        const normalizedName = normalizeProductLookup(input.name)
        product =
          products.find(
            (item) =>
              normalizeProductLookup(item.name) === normalizedName ||
              normalizeProductLookup(item.external_id) === normalizedName,
          ) || null
      }
      if (!product) {
        if (!navigator.onLine) {
          setError('Conéctate a internet para guardar un producto nuevo. Los productos existentes sí pueden venderse sin conexión.')
          return
        }
        const created = await apiClient.post<BazarProduct>('/bazar/products', {
          name: input.name,
          category: input.category,
          price: input.price,
          stock: 0,
          track_stock: false,
        })
        product = created
        setProducts((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ])
      }

      const sale = await submitSale(
        [{ product, quantity: input.quantity }],
        input.paymentMethod,
      )
      if (sale) {
        setPaymentMethod(input.paymentMethod)
        setShowQuickSale(false)
      }
    } catch (quickSaleError) {
      setError(getErrorMessage(quickSaleError, 'No se pudo guardar el producto para esta venta.'))
    } finally {
      setQuickSaleBusy(false)
    }
  }

  const flushOfflineSales = useCallback(async () => {
    if (flushingOfflineRef.current || !navigator.onLine) return
    const queue = readOfflineSales()
    if (queue.length === 0) {
      setOfflineQueueCount(0)
      return
    }

    flushingOfflineRef.current = true
    setFlushingOffline(true)
    const pending: OfflineSaleEntry[] = []
    try {
      for (const entry of [...queue].reverse()) {
        try {
          await apiClient.post<SaleResponse>('/bazar/sales', entry.payload)
        } catch {
          pending.unshift(entry)
        }
      }
      if (!writeOfflineSales(pending)) {
        setOfflineQueueCount(queue.length)
        setError('No se pudo actualizar la cola local. Libera espacio en el dispositivo e inténtalo de nuevo.')
        return
      }
      setOfflineQueueCount(pending.length)
      if (pending.length === 0) {
        await Promise.all([loadProducts(), loadActivity(activeBazarID), loadSyncStatus()])
      } else {
        setError(`Quedaron ${pending.length} ventas sin enviar. Se volverá a intentar.`)
      }
    } finally {
      flushingOfflineRef.current = false
      setFlushingOffline(false)
    }
  }, [activeBazarID, loadActivity, loadProducts, loadSyncStatus])

  useEffect(() => {
    const handleOnline = () => void flushOfflineSales()
    window.addEventListener('online', handleOnline)
    const initialRetry = window.setTimeout(() => {
      if (navigator.onLine && readOfflineSales().length > 0) void flushOfflineSales()
    }, 0)
    return () => {
      window.clearTimeout(initialRetry)
      window.removeEventListener('online', handleOnline)
    }
  }, [flushOfflineSales])

  const undoSale = async (sale: Sale) => {
    setError(null)
    if (sale.id.startsWith('offline-')) {
      const queue = readOfflineSales()
      const entry = queue.find((item) => item.sale.client_request_id === sale.client_request_id)
      const next = queue.filter((item) => item.sale.client_request_id !== sale.client_request_id)
      if (!writeOfflineSales(next)) {
        setError('No se pudo actualizar la cola local de ventas.')
        return
      }
      setOfflineQueueCount(next.length)
      if (entry) {
        setProducts((current) =>
          current.map((product) => {
            const restored = entry.sale.items.find((item) => item.product_id === product.id)
            return restored && productTracksStock(product)
              ? { ...product, stock: product.stock + restored.quantity }
              : product
          }),
        )
        const units = entry.sale.items.reduce((total, item) => total + item.quantity, 0)
        setStats((current) => {
          const operations = Math.max(0, current.operations - 1)
          const total = Math.max(0, current.total - entry.sale.total)
          return {
            ...current,
            total,
            products_sold: Math.max(0, current.products_sold - units),
            operations,
            average_ticket: operations > 0 ? total / operations : 0,
            pending_sync: Math.max(0, current.pending_sync - 1),
          }
        })
      }
      setSales((current) => current.filter((item) => item.id !== sale.id))
      setConfirmation(null)
      return
    }

    try {
      await apiClient.post(`/bazar/sales/${sale.id}/undo`)
      setConfirmation(null)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      await Promise.all([loadProducts(), loadActivity(activeBazarID), loadSyncStatus()])
    } catch (undoError) {
      setError(getErrorMessage(undoError, 'No se pudo deshacer la venta.'))
    }
  }

  const createBazar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setCreatingBazar(true)
    setError(null)
    try {
      const created = await apiClient.post<Bazar>('/bazar/bazaars', {
        name: String(form.get('name') || ''),
        location: String(form.get('location') || ''),
        default_payment_method: String(form.get('default_payment_method') || 'cash'),
        opening_cash: Number(form.get('opening_cash') || 0),
      })
      setBazaars((current) => [created, ...current])
      setActiveBazarID(created.id)
      setPaymentMethod(created.default_payment_method)
      setShowNewBazar(false)
    } catch (createError) {
      setError(getErrorMessage(createError, 'No se pudo iniciar el bazar.'))
    } finally {
      setCreatingBazar(false)
    }
  }

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setCreatingProduct(true)
    setError(null)
    try {
      const file = form.get('image_file')
      const uploadedImage = await imageFileToDataURL(file instanceof File ? file : null)
      const created = await apiClient.post<BazarProduct>('/bazar/products', {
        sku: String(form.get('sku') || ''),
        name: String(form.get('name') || ''),
        category: String(form.get('category') || ''),
        price: Number(form.get('price')),
        stock: Number(form.get('stock')),
        image_url: uploadedImage || String(form.get('image_url') || ''),
      })
      setProducts((current) => [created, ...current.filter((product) => product.id !== created.id)])
      setQuery('')
      setCategory('Todos')
      setStockFilter('all')
      setShowNewProduct(false)
    } catch (createError) {
      setError(getErrorMessage(createError, 'No se pudo guardar el producto.'))
    } finally {
      setCreatingProduct(false)
    }
  }

  const updateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingProduct) return
    const form = new FormData(event.currentTarget)
    setSavingProduct(true)
    setError(null)
    try {
      const file = form.get('image_file')
      const uploadedImage = await imageFileToDataURL(file instanceof File ? file : null)
      const removeImage = form.get('remove_image') === 'on'
      const edited = await apiClient.put<BazarProduct>(`/bazar/products/${editingProduct.id}`, {
        sku: String(form.get('sku') || ''),
        name: String(form.get('name') || ''),
        category: String(form.get('category') || ''),
        price: Number(form.get('price')),
        image_url: removeImage
          ? ''
          : uploadedImage || String(form.get('image_url') || '') || editingProduct.image_url || '',
        active: form.get('active') === 'on',
        stock_sync_policy: String(form.get('stock_sync_policy') || 'manual'),
      })
      setProducts((current) =>
        current.map((product) => (product.id === edited.id ? edited : product)),
      )
      setEditingProduct(null)
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'No se pudo actualizar el producto.'))
    } finally {
      setSavingProduct(false)
    }
  }

  const adjustStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adjustingProduct) return
    const form = new FormData(event.currentTarget)
    setSavingProduct(true)
    setError(null)
    try {
      const movementType = String(form.get('movement_type') || 'manual_adjustment')
      const selected = MOVEMENT_OPTIONS.find((item) => item.value === movementType)
      const rawQuantity = Number(form.get('quantity') || 0)
      const quantity = selected?.direction === 0 ? rawQuantity : rawQuantity * (selected?.direction || 1)
      const updated = await apiClient.post<BazarProduct>(
        `/bazar/products/${adjustingProduct.id}/adjust-stock`,
        {
          bazar_id: activeBazarID,
          movement_type: movementType,
          quantity,
          reason: String(form.get('reason') || ''),
        },
      )
      setProducts((current) =>
        current.map((product) => (product.id === updated.id ? updated : product)),
      )
      setAdjustingProduct(null)
    } catch (adjustError) {
      setError(getErrorMessage(adjustError, 'No se pudo ajustar el inventario.'))
    } finally {
      setSavingProduct(false)
    }
  }

  const openReport = async (bazarID = activeBazarID) => {
    setShowReport(true)
    setReportLoading(true)
    setError(null)
    try {
      const params = bazarID ? { bazar_id: bazarID } : undefined
      const [reportResponse, movementResponse, auditResponse] = await Promise.all([
        apiClient.get<BazarReport>('/bazar/reports/daily', { params }),
        apiClient.get<{ movements: InventoryMovement[] }>('/bazar/inventory-movements', {
          params: { ...params, limit: 100 },
        }),
        apiClient.get<{ audit: AuditLog[] }>('/bazar/audit', {
          params: { limit: 100 },
        }),
      ])
      setReport(reportResponse)
      setMovements(movementResponse.movements || [])
      setAuditLogs(auditResponse.audit || [])
    } catch (reportError) {
      setError(getErrorMessage(reportError, 'No se pudo generar el reporte.'))
      setShowReport(false)
    } finally {
      setReportLoading(false)
    }
  }

  const openCloseBazar = async () => {
    if (!activeBazarID) return
    setShowCloseBazar(true)
    setReportLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<BazarReport>(
        `/bazar/bazaars/${activeBazarID}/report`,
      )
      setReport(response)
    } catch (reportError) {
      setError(getErrorMessage(reportError, 'No se pudo preparar el corte de caja.'))
      setShowCloseBazar(false)
    } finally {
      setReportLoading(false)
    }
  }

  const closeBazar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeBazar) return
    if (offlineQueueCount > 0) {
      setError('Envía las ventas pendientes antes de cerrar el bazar.')
      return
    }
    const form = new FormData(event.currentTarget)
    setClosingBazar(true)
    setError(null)
    try {
      const response = await apiClient.post<{ bazar: Bazar; report: BazarReport }>(
        `/bazar/bazaars/${activeBazar.id}/close`,
        {
          closing_cash: Number(form.get('closing_cash') || 0),
          notes: String(form.get('notes') || ''),
        },
      )
      setBazaars((current) =>
        current.map((item) => (item.id === response.bazar.id ? response.bazar : item)),
      )
      setReport(response.report)
      setShowCloseBazar(false)
      setActiveBazarID('')
      localStorage.removeItem('dofer-active-bazar-id')
      setShowReport(true)
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'No se pudo cerrar el bazar.'))
    } finally {
      setClosingBazar(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Cargando ventas del bazar...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24">
      <section className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {dateFormatter.format(new Date())}
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {currentUser?.full_name || currentUser?.email || 'Vendedor'}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
              Ventas del bazar
            </h1>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
            <label className="relative min-w-0 sm:min-w-64">
              <span className="sr-only">Bazar activo</span>
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={activeBazarID}
                onChange={(event) => {
                  const bazarID = event.target.value
                  setActiveBazarID(bazarID)
                  const selected = bazaars.find((item) => item.id === bazarID)
                  if (selected) setPaymentMethod(selected.default_payment_method)
                }}
                className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-10 pr-10 text-sm font-medium"
              >
                {bazaars.filter((item) => item.status === 'active').map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {!activeBazarID && <option value="">Sin bazar activo</option>}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>

            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={!syncStatus?.configured || !canSell || syncing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title="Sincronizar con Google Sheets"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando' : syncLabel(syncStatus)}
            </button>

            <button
              type="button"
              onClick={() => void openReport()}
              disabled={reportLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {reportLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Reporte
            </button>

            {activeBazar && canSell && (
              <button
                type="button"
                onClick={() => void openCloseBazar()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-background px-4 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <WalletCards className="h-4 w-4" />
                Corte
              </button>
            )}

            {canSell && (
              <button
                type="button"
                onClick={() => setShowQuickSale(true)}
                disabled={!activeBazar}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ReceiptText className="h-4 w-4" />
                Nueva venta
              </button>
            )}

            {canSell && (
              <button
                type="button"
                onClick={() => setShowNewBazar(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Nuevo bazar
              </button>
            )}
          </div>
        </div>

        {activeBazar?.location && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {activeBazar.location}
          </p>
        )}
      </section>

      {error && (
        <div className="flex items-start justify-between gap-3 border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0"
            title="Cerrar mensaje"
            aria-label="Cerrar mensaje"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {syncStatus && syncStatus.status !== 'synced' && (
        <SyncNotice status={syncStatus} onRetry={() => void syncNow()} canRetry={canSell} />
      )}

      {offlineQueueCount > 0 && (
        <div className="flex flex-col gap-3 border border-cyan-300 bg-cyan-50 p-3 text-sm text-cyan-950 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            {offlineQueueCount} {offlineQueueCount === 1 ? 'venta guardada' : 'ventas guardadas'} en este dispositivo.
          </span>
          <button
            type="button"
            onClick={() => void flushOfflineSales()}
            disabled={flushingOffline}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-current px-3 font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${flushingOffline ? 'animate-spin' : ''}`} />
            Enviar ahora
          </button>
        </div>
      )}

      {!canSell && (
        <div className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Tu cuenta tiene acceso de lectura. Un administrador debe asignarte el rol Operador para registrar ventas.
        </div>
      )}

      <section className="grid grid-cols-2 border-y border-border md:grid-cols-5">
        <Metric label="Vendido hoy" value={moneyFormatter.format(stats.total)} emphasized />
        <Metric label="Productos" value={String(stats.products_sold)} />
        <Metric label="Operaciones" value={String(stats.operations)} />
        <Metric label="Ticket promedio" value={moneyFormatter.format(stats.average_ticket)} />
        <Metric
          label="Última venta"
          value={stats.last_sale_at ? timeFormatter.format(new Date(stats.last_sale_at)) : 'Sin ventas'}
          className="col-span-2 md:col-span-1"
        />
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="sticky top-[73px] z-30 -mx-4 space-y-3 border-y border-border bg-background/95 px-4 py-3 backdrop-blur-md md:static md:mx-0 md:border-x md:px-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Buscar producto</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por producto, código o categoría"
                  className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-4 text-base"
                />
              </label>
              <label className="relative sm:w-44">
                <span className="sr-only">Filtrar por stock</span>
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value as StockFilter)}
                  className="h-12 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm"
                >
                  <option value="all">Todo el stock</option>
                  <option value="available">Disponibles</option>
                  <option value="low">Stock bajo</option>
                  <option value="out">Agotados</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </label>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent sm:w-12 sm:px-0"
                title="Escanear código"
              >
                <ScanLine className="h-5 w-5" />
                <span className="sm:sr-only">Escanear código</span>
              </button>
            </div>

            <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`h-9 shrink-0 rounded-md border px-3 text-sm font-medium ${
                    category === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-accent'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Catálogo</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {`${visibleProducts.length} ${visibleProducts.length === 1 ? 'producto' : 'productos'}`}
              </span>
              {canSell && (
                <button
                  type="button"
                  onClick={() => setShowNewProduct(true)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                >
                  <PackagePlus className="h-4 w-4" />
                  Agregar producto
                </button>
              )}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <EmptyCatalog
              hasProducts={products.length > 0}
              configured={syncStatus?.configured ?? false}
              onSync={() => void syncNow()}
              canSync={canSell}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  busy={sellingProducts.has(product.id)}
                  disabled={!canSell || !activeBazar || !product.active}
                  canEdit={canSell}
                  onSell={() => void registerSale(product, 1)}
                  onMultiple={() => {
                    setQuantityProduct(product)
                    setQuantity(Math.min(2, productSaleLimit(product)))
                  }}
                  onCart={() => addToCart(product)}
                  onEdit={() => setEditingProduct(product)}
                  onAdjust={() => setAdjustingProduct(product)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-semibold">Ventas recientes</h2>
              <p className="text-sm text-muted-foreground">Actividad de hoy</p>
            </div>
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
          </div>

          {sales.length === 0 ? (
            <div className="border border-dashed border-border p-6 text-center">
              <ReceiptText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Aún no hay ventas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La primera aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => (
                <RecentSale
                  key={sale.id}
                  sale={sale}
                  onUndo={() => void undoSale(sale)}
                  onReceipt={() => setReceiptSale(sale)}
                  canUndo={canSell}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      {quantityProduct && (
        <QuantityDialog
          product={quantityProduct}
          quantity={quantity}
          paymentMethod={paymentMethod}
          busy={sellingProducts.has(quantityProduct.id)}
          onQuantityChange={setQuantity}
          onPaymentChange={setPaymentMethod}
          onClose={() => setQuantityProduct(null)}
          onConfirm={() => void registerSale(quantityProduct, quantity)}
        />
      )}

      {showQuickSale && activeBazar && canSell && (
        <QuickSaleDialog
          bazarName={activeBazar.name}
          products={quickSaleProducts}
          defaultPaymentMethod={paymentMethod}
          busy={quickSaleBusy}
          onClose={() => setShowQuickSale(false)}
          onSubmit={(input) => void submitQuickSale(input)}
        />
      )}

      {showNewBazar && canSell && (
        <NewBazarDialog
          creating={creatingBazar}
          onClose={() => setShowNewBazar(false)}
          onSubmit={createBazar}
        />
      )}

      {showNewProduct && canSell && (
        <ProductDialog
          creating={creatingProduct}
          onClose={() => setShowNewProduct(false)}
          onSubmit={createProduct}
        />
      )}

      {editingProduct && canSell && (
        <ProductDialog
          product={editingProduct}
          creating={savingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={updateProduct}
        />
      )}

      {adjustingProduct && canSell && (
        <StockAdjustmentDialog
          product={adjustingProduct}
          saving={savingProduct}
          onClose={() => setAdjustingProduct(null)}
          onSubmit={adjustStock}
        />
      )}

      {showCart && (
        <CartDialog
          items={cartProducts}
          units={cartUnits}
          total={cartTotal}
          paymentMethod={paymentMethod}
          busy={cartBusy}
          onPaymentChange={setPaymentMethod}
          onQuantityChange={updateCartQuantity}
          onClose={() => setShowCart(false)}
          onConfirm={() => void submitCartSale()}
        />
      )}

      {showCloseBazar && activeBazar && (
        <CloseBazarDialog
          bazar={activeBazar}
          stats={stats}
          report={report}
          reportLoading={reportLoading}
          offlineQueueCount={offlineQueueCount}
          closing={closingBazar}
          onClose={() => setShowCloseBazar(false)}
          onSubmit={closeBazar}
        />
      )}

      {showReport && (
        <ReportDialog
          report={report}
          movements={movements}
          auditLogs={auditLogs}
          loading={reportLoading}
          onClose={() => setShowReport(false)}
        />
      )}

      {showScanner && (
        <ScannerDialog
          onClose={() => setShowScanner(false)}
          onDetected={(value) => {
            setQuery(value)
            setShowScanner(false)
          }}
        />
      )}

      {syncConflicts.length > 0 && (
        <SyncConflictDialog
          conflicts={syncConflicts}
          busy={syncing}
          onClose={() => setSyncConflicts([])}
          onResolve={(strategy) => void performSync(strategy)}
        />
      )}

      {receiptSale && (
        <ReceiptDialog sale={receiptSale} onClose={() => setReceiptSale(null)} />
      )}

      {confirmation && (
        <SaleConfirmation
          sale={confirmation}
          onClose={() => setConfirmation(null)}
          onUndo={() => void undoSale(confirmation)}
          onReceipt={() => setReceiptSale(confirmation)}
        />
      )}

      {cartUnits > 0 && !showCart && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-1/2 z-50 flex h-14 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between rounded-md bg-foreground px-4 text-background shadow-2xl hover:opacity-95"
        >
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <span>{cartUnits} {cartUnits === 1 ? 'producto' : 'productos'}</span>
          </span>
          <span className="font-semibold">{moneyFormatter.format(cartTotal)}</span>
        </button>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  emphasized = false,
  className = '',
}: {
  label: string
  value: string
  emphasized?: boolean
  className?: string
}) {
  return (
    <div className={`min-w-0 border-r border-border p-3 last:border-r-0 md:p-4 ${className}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate font-semibold ${emphasized ? 'text-xl text-primary' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  )
}

function SyncNotice({
  status,
  onRetry,
  canRetry,
}: {
  status: SyncStatus
  onRetry: () => void
  canRetry: boolean
}) {
  const notConfigured = status.status === 'not_configured'
  const isError = status.status === 'error'
  return (
    <div className={`flex flex-col gap-3 border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
      isError
        ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
        : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
    }`}>
      <span className="flex items-start gap-2">
        {notConfigured ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {notConfigured
            ? 'Modo manual activo. Las ventas se guardarán en el sistema.'
            : status.last_error || `${status.pending_sales + status.failed_sales} ventas requieren sincronización.`}
        </span>
      </span>
      {!notConfigured && canRetry && (
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-current px-3 font-medium">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  )
}

function ProductCard({
  product,
  busy,
  disabled,
  canEdit,
  onSell,
  onMultiple,
  onCart,
  onEdit,
  onAdjust,
}: {
  product: BazarProduct
  busy: boolean
  disabled: boolean
  canEdit: boolean
  onSell: () => void
  onMultiple: () => void
  onCart: () => void
  onEdit: () => void
  onAdjust: () => void
}) {
  const soldOut = productTracksStock(product) && product.stock === 0
  const lowStock = productTracksStock(product) && product.stock > 0 && product.stock <= 2
  const unavailable = disabled || soldOut || busy

  return (
    <article className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image_url ? (
          // Las URL vienen del inventario y pueden usar proveedores distintos.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-xs font-semibold ${
          !product.active
            ? 'bg-zinc-700 text-white'
            : soldOut
            ? 'bg-red-600 text-white'
            : lowStock
              ? 'bg-amber-400 text-amber-950'
              : 'bg-emerald-600 text-white'
        }`}>
          {!product.active
            ? 'Inactivo'
            : soldOut
            ? 'Agotado'
            : !productTracksStock(product)
              ? 'Venta libre'
            : lowStock
              ? `Quedan ${product.stock}`
              : `${product.stock} disponibles`}
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{product.name}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">{product.category || 'Sin categoría'}</span>
            <span className="shrink-0 font-semibold text-primary">{moneyFormatter.format(product.price)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onSell}
            disabled={unavailable}
            className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="truncate">{!product.active ? 'Inactivo' : soldOut ? 'Agotado' : '+1 vendido'}</span>
          </button>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={onCart}
              disabled={unavailable}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title="Agregar al carrito"
              aria-label={`Agregar ${product.name} al carrito`}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMultiple}
              disabled={unavailable}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title="Vender varias unidades"
              aria-label={`Vender varias unidades de ${product.name}`}
            >
              <Layers3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onAdjust}
              disabled={!canEdit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
              title="Ajustar inventario"
              aria-label={`Ajustar inventario de ${product.name}`}
            >
              <PackagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={!canEdit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
              title="Editar producto"
              aria-label={`Editar ${product.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function QuickSaleDialog({
  bazarName,
  products,
  defaultPaymentMethod,
  busy,
  onClose,
  onSubmit,
}: {
  bazarName: string
  products: BazarProduct[]
  defaultPaymentMethod: PaymentMethod
  busy: boolean
  onClose: () => void
  onSubmit: (input: QuickSaleInput) => void
}) {
  const [search, setSearch] = useState('')
  const [selectedProductID, setSelectedProductID] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod)

  const normalizedSearch = normalizeProductLookup(search)
  const selectedProduct =
    products.find((product) => product.id === selectedProductID) || null
  const exactProduct =
    !selectedProduct && normalizedSearch
      ? products.find(
          (product) =>
            normalizeProductLookup(product.name) === normalizedSearch ||
            normalizeProductLookup(product.external_id) === normalizedSearch,
        ) || null
      : null
  const resolvedProduct = selectedProduct || exactProduct

  const matchingProducts = useMemo(() => {
    const candidates = products.filter((product) => {
      if (!product.active) return false
      if (!normalizedSearch) return true
      return (
        normalizeProductLookup(product.name).includes(normalizedSearch) ||
        normalizeProductLookup(product.external_id).includes(normalizedSearch) ||
        normalizeProductLookup(product.category).includes(normalizedSearch)
      )
    })
    return candidates
      .sort((first, second) => {
        const rank = (product: BazarProduct) => {
          const name = normalizeProductLookup(product.name)
          const code = normalizeProductLookup(product.external_id)
          if (name === normalizedSearch || code === normalizedSearch) return 0
          if (name.startsWith(normalizedSearch)) return 1
          if (code.startsWith(normalizedSearch)) return 2
          return 3
        }
        return rank(first) - rank(second)
      })
      .slice(0, 6)
  }, [normalizedSearch, products])

  const newProductName = search.trim()
  const isNewProduct =
    !resolvedProduct &&
    newProductName.length > 0 &&
    (createNew || matchingProducts.length === 0)
  const quantityLimit = resolvedProduct
    ? productSaleLimit(resolvedProduct)
    : MAX_SALE_QUANTITY
  const unitPrice = resolvedProduct?.price ?? Number(price || 0)
  const unavailable =
    resolvedProduct !== null &&
    (!resolvedProduct.active ||
      (productTracksStock(resolvedProduct) && resolvedProduct.stock === 0))
  const validNewProduct =
    isNewProduct &&
    price.trim() !== '' &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0
  const canSubmit =
    !busy &&
    !unavailable &&
    quantity >= 1 &&
    quantity <= quantityLimit &&
    (resolvedProduct !== null || validNewProduct)

  const selectProduct = (product: BazarProduct) => {
    setSelectedProductID(product.id)
    setSearch(product.name)
    setCreateNew(false)
    setQuantity(Math.min(quantity, productSaleLimit(product)) || 1)
  }

  const resetSelection = () => {
    setSelectedProductID('')
    setCreateNew(false)
    setSearch('')
    setPrice('')
    setCategory('')
    setQuantity(1)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({
      product: resolvedProduct,
      name: newProductName,
      category: category.trim(),
      price: unitPrice,
      quantity,
      paymentMethod,
    })
  }

  return (
    <DialogBackdrop onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader eyebrow={bazarName} title="Nueva venta" onClose={onClose} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Producto</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setSelectedProductID('')
                    setCreateNew(false)
                    setQuantity(1)
                  }}
                  autoFocus
                  autoComplete="off"
                  placeholder="Nombre o código"
                  className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-11 text-base"
                />
                {search && (
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="absolute right-1 top-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    title="Limpiar producto"
                    aria-label="Limpiar producto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </label>

            {!resolvedProduct && !isNewProduct && (
              <div className="border-y border-border">
                <p className="py-2 text-xs font-medium uppercase text-muted-foreground">
                  {normalizedSearch ? 'Coincidencias' : 'Selección rápida'}
                </p>
                {matchingProducts.map((product) => {
                  const soldOut = productTracksStock(product) && product.stock === 0
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      disabled={soldOut}
                      className="flex min-h-14 w-full items-center gap-3 border-t border-border py-2 text-left hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <PackageCheck className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {product.category || product.external_id}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold">{moneyFormatter.format(product.price)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {!productTracksStock(product)
                            ? 'Venta libre'
                            : soldOut
                              ? 'Agotado'
                              : `${product.stock} disponibles`}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {matchingProducts.length === 0 && !normalizedSearch && (
                  <p className="border-t border-border py-4 text-sm text-muted-foreground">
                    Sin productos guardados.
                  </p>
                )}
                {normalizedSearch && (
                  <button
                    type="button"
                    onClick={() => setCreateNew(true)}
                    className="flex min-h-14 w-full items-center gap-3 border-t border-border py-2 text-left font-medium text-primary hover:bg-accent/60"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate">Crear “{newProductName}”</span>
                  </button>
                )}
              </div>
            )}

            {resolvedProduct && (
              <div className="flex items-center gap-3 border-y border-border py-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <PackageCheck className="h-5 w-5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{resolvedProduct.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {moneyFormatter.format(resolvedProduct.price)}
                    {' · '}
                    {!resolvedProduct.active
                      ? 'Inactivo'
                      : !productTracksStock(resolvedProduct)
                        ? 'Venta libre'
                        : `${resolvedProduct.stock} disponibles`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={resetSelection}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
                  title="Cambiar producto"
                  aria-label="Cambiar producto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {isNewProduct && (
              <div className="space-y-4 border-y border-border py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Producto nuevo</p>
                    <p className="truncate font-semibold">{newProductName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
                    title="Cambiar producto"
                    aria-label="Cambiar producto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Precio</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        required
                        min="0"
                        max="999999999"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Categoría</span>
                    <input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      maxLength={100}
                      placeholder="Opcional"
                      className="h-11 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>
                </div>
              </div>
            )}

            {(resolvedProduct || isNewProduct) && (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_148px] gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Método de pago</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="h-11 w-full rounded-md border border-input bg-background px-3"
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="mb-1.5 block text-sm font-medium">Cantidad</span>
                    <div className="grid h-11 grid-cols-[36px_1fr_36px] overflow-hidden rounded-md border border-input">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="inline-flex items-center justify-center hover:bg-accent disabled:opacity-40"
                        title="Restar unidad"
                        aria-label="Restar unidad"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={quantityLimit}
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(
                            Math.min(
                              quantityLimit,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          )
                        }
                        className="min-w-0 border-x border-input bg-background text-center font-semibold"
                        aria-label="Cantidad"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(quantityLimit, quantity + 1))}
                        disabled={quantity >= quantityLimit}
                        className="inline-flex items-center justify-center hover:bg-accent disabled:opacity-40"
                        title="Agregar unidad"
                        aria-label="Agregar unidad"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {unavailable && (
                  <p className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Producto no disponible para venta.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-muted/45 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
            <p className="truncate text-2xl font-semibold text-primary">
              {moneyFormatter.format(unitPrice * quantity)}
            </p>
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isNewProduct ? 'Guardar y cobrar' : 'Cobrar'}
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}

function QuantityDialog({
  product,
  quantity,
  paymentMethod,
  busy,
  onQuantityChange,
  onPaymentChange,
  onClose,
  onConfirm,
}: {
  product: BazarProduct
  quantity: number
  paymentMethod: PaymentMethod
  busy: boolean
  onQuantityChange: (quantity: number) => void
  onPaymentChange: (method: PaymentMethod) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const quantityLimit = productSaleLimit(product)
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card text-card-foreground shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Venta de varias unidades</p>
            <h2 id="quantity-title" className="mt-1 text-xl font-semibold">{product.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 px-5 py-6">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            title="Restar unidad"
            aria-label="Restar unidad"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            type="number"
            min={1}
            max={quantityLimit}
            value={quantity}
            onChange={(event) => onQuantityChange(Math.min(quantityLimit, Math.max(1, Number(event.target.value) || 1)))}
            className="h-14 w-24 rounded-md border border-input bg-background text-center text-2xl font-semibold"
            aria-label="Cantidad"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(quantityLimit, quantity + 1))}
            disabled={quantity >= quantityLimit}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            title="Agregar unidad"
            aria-label="Agregar unidad"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <label className="mx-5 block">
          <span className="mb-2 block text-sm font-medium">Método de pago</span>
          <select
            value={paymentMethod}
            onChange={(event) => onPaymentChange(event.target.value as PaymentMethod)}
            className="h-11 w-full rounded-md border border-input bg-background px-3"
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex items-center justify-between border-t border-border bg-muted/45 px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold text-primary">{moneyFormatter.format(product.price * quantity)}</p>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Registrar venta
          </button>
        </div>
      </div>
    </div>
  )
}

function RecentSale({
  sale,
  onUndo,
  onReceipt,
  canUndo,
}: {
  sale: Sale
  onUndo: () => void
  onReceipt: () => void
  canUndo: boolean
}) {
  const itemSummary = sale.items
    .map((item) => `${item.quantity} ${item.product_name}`)
    .join(', ')
  return (
    <article className={`rounded-md border p-3 ${
      sale.status === 'cancelled' ? 'border-border bg-muted/50 opacity-70' : 'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {timeFormatter.format(new Date(sale.created_at))}
            <SyncDot status={sale.sync_status} />
          </div>
          <p className={`mt-1 line-clamp-2 text-sm font-medium ${sale.status === 'cancelled' ? 'line-through' : ''}`}>
            {itemSummary}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {paymentLabel(sale.payment_method)} · {sale.seller_name}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <p className="font-semibold">{moneyFormatter.format(sale.total)}</p>
          {sale.status === 'cancelled' ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Cancelada</span>
          ) : canUndo ? (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Undo2 className="h-3.5 w-3.5" />
              Deshacer
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReceipt}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Ticket
          </button>
        </div>
      </div>
    </article>
  )
}

function SyncDot({ status }: { status: Sale['sync_status'] }) {
  if (status === 'synced') {
    return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Wifi className="h-3.5 w-3.5" /> Sincronizada</span>
  }
  if (status === 'error') {
    return <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><CloudOff className="h-3.5 w-3.5" /> Error</span>
  }
  return <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock3 className="h-3.5 w-3.5" /> Pendiente</span>
}

function SaleConfirmation({
  sale,
  onClose,
  onUndo,
  onReceipt,
}: {
  sale: Sale
  onClose: () => void
  onUndo: () => void
  onReceipt: () => void
}) {
  const units = sale.items.reduce((total, item) => total + item.quantity, 0)
  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-lg rounded-md border border-emerald-300 bg-emerald-950 p-4 text-white shadow-xl">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Venta registrada</p>
              <p className="mt-0.5 truncate text-sm text-emerald-100">
                {units} {units === 1 ? 'producto' : 'productos'} · {moneyFormatter.format(sale.total)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-emerald-100 hover:text-white" title="Cerrar" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SyncDot status={sale.sync_status} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={onReceipt} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-sm font-medium hover:bg-emerald-900">
                <ReceiptText className="h-4 w-4" />
                Ticket
              </button>
              <button type="button" onClick={onUndo} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-sm font-medium hover:bg-emerald-900">
                <Undo2 className="h-4 w-4" />
                Deshacer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewBazarDialog({
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

function ProductDialog({
  product,
  creating,
  onClose,
  onSubmit,
}: {
  product?: BazarProduct
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
        aria-labelledby="product-dialog-title"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-lg border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">{product ? product.external_id : 'Catálogo manual'}</p>
            <h2 id="product-dialog-title" className="mt-1 text-xl font-semibold">
              {product ? 'Editar producto' : 'Agregar producto'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nombre del producto</span>
            <input
              name="name"
              required
              autoFocus
              maxLength={160}
              defaultValue={product?.name}
              placeholder="Ej. Capibara café"
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Código / SKU (opcional)</span>
              <input
                name="sku"
                maxLength={80}
                defaultValue={product?.external_id}
                placeholder="Ej. CAP-01"
                className="h-11 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Categoría</span>
              <input
                name="category"
                maxLength={100}
                defaultValue={product?.category}
                placeholder="Ej. Doflins"
                className="h-11 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Precio</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  name="price"
                  type="number"
                  required
                  min="0"
                  max="999999999"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={product?.price}
                  placeholder="0.00"
                  className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
                />
              </div>
            </label>
            {!product ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Stock inicial</span>
                <input
                  name="stock"
                  type="number"
                  required
                  min="0"
                  max="999999"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
            ) : (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {productTracksStock(product) ? 'Existencia actual' : 'Control de stock'}
                </p>
                <p className="font-semibold">
                  {productTracksStock(product) ? `${product.stock} unidades` : 'Venta libre'}
                </p>
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">URL de imagen (opcional)</span>
            <input
              name="image_url"
              type="text"
              defaultValue={product?.image_url?.startsWith('http') ? product.image_url : ''}
              placeholder="https://..."
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
          <label className="block rounded-md border border-dashed border-input p-3">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" />
              Subir imagen
            </span>
            <input name="image_file" type="file" accept="image/*" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:font-medium" />
          </label>
          {product && (
            <>
              <label className="flex items-center gap-3 text-sm">
                <input name="remove_image" type="checkbox" className="h-4 w-4 rounded border-input" />
                Quitar imagen actual
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Stock al sincronizar</span>
                  <select
                    name="stock_sync_policy"
                    defaultValue={product.stock_sync_policy || 'manual'}
                    className="h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    <option value="manual">Conservar ajuste manual</option>
                    <option value="sheets">Usar valor de Sheets</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-md border border-input px-3 py-2.5 text-sm">
                  <input name="active" type="checkbox" defaultChecked={product.active} className="h-4 w-4 rounded border-input" />
                  Producto activo
                </label>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button type="submit" disabled={creating} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : product ? <Check className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            {product ? 'Guardar cambios' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

function DialogBackdrop({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

function DialogHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string
  title: string
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        title="Cerrar"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

function StockAdjustmentDialog({
  product,
  saving,
  onClose,
  onSubmit,
}: {
  product: BazarProduct
  saving: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_OPTIONS)[number]['value']>('inventory_entry')
  const manual = movementType === 'manual_adjustment'

  return (
    <DialogBackdrop onClose={onClose}>
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader
          eyebrow={`${product.name} · ${productTracksStock(product) ? `${product.stock} disponibles` : 'Venta libre'}`}
          title="Ajustar inventario"
          onClose={onClose}
        />
        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Movimiento</span>
            <select
              name="movement_type"
              value={movementType}
              onChange={(event) => setMovementType(event.target.value as typeof movementType)}
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            >
              {MOVEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {manual ? 'Cambio de stock (+ / -)' : 'Cantidad'}
            </span>
            <input
              key={movementType}
              name="quantity"
              type="number"
              required
              min={manual ? -999999 : 1}
              max="999999"
              defaultValue={manual ? '' : 1}
              placeholder={manual ? 'Ej. -2 o 5' : '1'}
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Motivo o nota</span>
            <textarea name="reason" rows={3} maxLength={300} className="w-full resize-none rounded-md border border-input bg-background p-3" placeholder="Detalle del movimiento" />
          </label>
        </div>
        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button type="submit" disabled={saving} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Registrar movimiento
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}

function CartDialog({
  items,
  units,
  total,
  paymentMethod,
  busy,
  onPaymentChange,
  onQuantityChange,
  onClose,
  onConfirm,
}: {
  items: Array<{ product: BazarProduct; quantity: number }>
  units: number
  total: number
  paymentMethod: PaymentMethod
  busy: boolean
  onPaymentChange: (method: PaymentMethod) => void
  onQuantityChange: (product: BazarProduct, quantity: number) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={`${units} ${units === 1 ? 'unidad' : 'unidades'}`} title="Carrito de venta" onClose={onClose} />
        <div className="divide-y divide-border px-5">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center gap-3 py-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="m-4 h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="text-sm text-muted-foreground">{moneyFormatter.format(product.price * quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => onQuantityChange(product, quantity - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input" title="Restar">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <button type="button" onClick={() => onQuantityChange(product, quantity + 1)} disabled={quantity >= productSaleLimit(product)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input disabled:opacity-40" title="Sumar">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onQuantityChange(product, 0)} className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">El carrito está vacío.</p>}
        </div>
        <div className="space-y-4 border-t border-border bg-muted/35 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Método de pago</span>
            <select value={paymentMethod} onChange={(event) => onPaymentChange(event.target.value as PaymentMethod)} className="h-11 w-full rounded-md border border-input bg-background px-3">
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onConfirm} disabled={busy || items.length === 0} className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Cobrar
            </span>
            <span>{moneyFormatter.format(total)}</span>
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}

function CloseBazarDialog({
  bazar,
  stats,
  report,
  reportLoading,
  offlineQueueCount,
  closing,
  onClose,
  onSubmit,
}: {
  bazar: Bazar
  stats: DailyStats
  report: BazarReport | null
  reportLoading: boolean
  offlineQueueCount: number
  closing: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [countedCash, setCountedCash] = useState('')
  const expectedCash = report?.expected_cash ?? bazar.opening_cash
  const difference = countedCash === '' ? null : Number(countedCash) - expectedCash

  return (
    <DialogBackdrop onClose={onClose}>
      <form onSubmit={onSubmit} role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={bazar.name} title="Corte y cierre" onClose={onClose} />
        <div className="grid grid-cols-2 border-b border-border">
          <Metric label="Fondo inicial" value={moneyFormatter.format(bazar.opening_cash)} />
          <Metric label="Ventas totales" value={moneyFormatter.format(stats.total)} />
        </div>
        <div className="space-y-5 px-5 py-5">
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
            <span className="mb-1.5 block text-sm font-medium">Notas del cierre</span>
            <textarea name="notes" rows={3} maxLength={500} className="w-full resize-none rounded-md border border-input bg-background p-3" />
          </label>
        </div>
        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button type="submit" disabled={closing || reportLoading || offlineQueueCount > 0} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {closing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
            Cerrar bazar y generar corte
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}

function ReportDialog({
  report,
  movements,
  auditLogs,
  loading,
  onClose,
}: {
  report: BazarReport | null
  movements: InventoryMovement[]
  auditLogs: AuditLog[]
  loading: boolean
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
            <button type="button" onClick={() => downloadDailyReportPDF(report)} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>
    </DialogBackdrop>
  )
}

function ActivityList({
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

function ScannerDialog({
  onClose,
  onDetected,
}: {
  onClose: () => void
  onDetected: (value: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scannerError, setScannerError] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false

    const start = async () => {
      const Detector = (window as unknown as {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
        }
      }).BarcodeDetector
      if (!Detector) {
        setScannerError('Este navegador no permite lectura automática. Captura el código manualmente.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!videoRef.current || stopped) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        })
        const scan = async () => {
          if (stopped || !videoRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            if (results[0]?.rawValue) {
              onDetected(results[0].rawValue)
              return
            }
          } catch {
            // Algunos navegadores fallan mientras el video todavía se inicializa.
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch {
        setScannerError('No se pudo abrir la cámara. Revisa el permiso o captura el código manualmente.')
      }
    }

    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])

  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow="Código de barras o QR" title="Buscar con cámara" onClose={onClose} />
        <div className="space-y-4 p-5">
          <div className="relative aspect-video overflow-hidden rounded-md bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 border-t-2 border-cyan-400" />
            <Camera className="absolute bottom-3 right-3 h-5 w-5 text-white/80" />
          </div>
          {scannerError && <p className="text-sm text-amber-700 dark:text-amber-300">{scannerError}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (manualCode.trim()) onDetected(manualCode.trim())
            }}
            className="flex gap-2"
          >
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Escribe o pega el código" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3" />
            <button type="submit" disabled={!manualCode.trim()} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50">Buscar</button>
          </form>
        </div>
      </div>
    </DialogBackdrop>
  )
}

function SyncConflictDialog({
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

function ReceiptDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const text = receiptText(sale)
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={sale.external_id} title="Comprobante de venta" onClose={onClose} />
        <div className="p-5">
          <pre className="whitespace-pre-wrap border-y border-dashed border-border py-5 font-sans text-sm leading-6">{text}</pre>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/35 p-4">
          <button type="button" onClick={() => printReceipt(sale)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent" title="Imprimir">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent" title="Enviar por WhatsApp">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`Comprobante ${sale.external_id}`)}&body=${encodeURIComponent(text)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground" title="Enviar por correo">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Correo</span>
          </a>
        </div>
      </div>
    </DialogBackdrop>
  )
}

function EmptyCatalog({
  hasProducts,
  configured,
  onSync,
  canSync,
}: {
  hasProducts: boolean
  configured: boolean
  onSync: () => void
  canSync: boolean
}) {
  return (
    <div className="border border-dashed border-border px-5 py-12 text-center">
      {hasProducts ? <PackageX className="mx-auto h-10 w-10 text-muted-foreground" /> : <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" />}
      <h3 className="mt-3 font-semibold">{hasProducts ? 'No hay coincidencias' : 'El catálogo está vacío'}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {hasProducts
          ? 'Cambia la búsqueda o los filtros.'
          : configured
            ? 'Sincroniza el inventario para cargar los productos.'
            : 'Agrega el primer producto para comenzar a operar.'}
      </p>
      {!hasProducts && configured && canSync && (
        <button type="button" onClick={onSync} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          <RefreshCw className="h-4 w-4" />
          Sincronizar inventario
        </button>
      )}
    </div>
  )
}

function syncLabel(status: SyncStatus | null) {
  if (!status) return 'Comprobando'
  if (status.status === 'synced') return 'Sincronizado'
  if (status.status === 'pending') return `${status.pending_sales} pendientes`
  if (status.status === 'error') return 'Error de sincronización'
  return 'Sheets sin configurar'
}

function paymentLabel(method: PaymentMethod) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label || 'Otro'
}

function movementLabel(type: string) {
  return MOVEMENT_OPTIONS.find((item) => item.value === type)?.label || type
}
