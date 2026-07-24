'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudOff,
  ImageOff,
  Layers3,
  LoaderCircle,
  MapPin,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Store,
  Undo2,
  UserRound,
  Wifi,
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
  image_url?: string
  active: boolean
}

interface Bazar {
  id: string
  name: string
  location?: string
  status: 'active' | 'closed' | 'archived'
  default_payment_method: PaymentMethod
  starts_at: string
  ends_at?: string
}

interface SaleItem {
  product_id: string
  product_external_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
  stock_after: number
}

interface Sale {
  id: string
  external_id: string
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
type StockFilter = 'all' | 'available' | 'low' | 'out'

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
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeBazar = useMemo(
    () => bazaars.find((item) => item.id === activeBazarID),
    [activeBazarID, bazaars],
  )
  const canSell = ['admin', 'operator'].includes(
    currentUser?.organization_role || currentUser?.role || '',
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
        (stockFilter === 'available' && product.stock > 0) ||
        (stockFilter === 'low' && product.stock > 0 && product.stock <= 2) ||
        (stockFilter === 'out' && product.stock === 0)
      return product.active && matchesQuery && matchesCategory && matchesStock
    })
  }, [category, products, query, stockFilter])

  const loadProducts = useCallback(async () => {
    const response = await apiClient.get<{ products: BazarProduct[] }>('/bazar/products')
    setProducts(response.products || [])
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
    setStats(statsResponse)
    setSales(salesResponse.sales || [])
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
        } else {
          setShowNewBazar(availableBazaars.length === 0)
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
            await apiClient.post('/bazar/sync')
          } catch (syncError) {
            if (!cancelled) {
              setError(getErrorMessage(syncError, 'No se pudo sincronizar Google Sheets.'))
            }
          } finally {
            if (!cancelled) setSyncing(false)
          }
        }

        await loadProducts()
        if (!cancelled) await loadSyncStatus()
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, 'No se pudo cargar Ventas del bazar.'))
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
    const selected = bazaars.find((item) => item.id === activeBazarID)
    if (selected) setPaymentMethod(selected.default_payment_method)

    void loadActivity(activeBazarID).catch((activityError) => {
      setError(getErrorMessage(activityError, 'No se pudo cargar la actividad del día.'))
    })
  }, [activeBazarID, bazaars, loadActivity])

  const syncNow = async () => {
    if (!canSell || syncing) return
    setSyncing(true)
    setError(null)
    try {
      await apiClient.post('/bazar/sync')
      await Promise.all([
        loadProducts(),
        loadSyncStatus(),
        loadActivity(activeBazarID),
      ])
    } catch (syncError) {
      setError(getErrorMessage(syncError, 'No se pudo sincronizar Google Sheets.'))
      await loadSyncStatus().catch(() => undefined)
    } finally {
      setSyncing(false)
    }
  }

  const registerSale = async (product: BazarProduct, requestedQuantity: number) => {
    if (!activeBazar || !canSell || sellingProducts.has(product.id)) return
    if (requestedQuantity <= 0 || requestedQuantity > product.stock) {
      setError(`Solo hay ${product.stock} unidades disponibles de ${product.name}.`)
      return
    }

    setSellingProducts((current) => new Set(current).add(product.id))
    setError(null)
    try {
      const response = await apiClient.post<SaleResponse>('/bazar/sales', {
        client_request_id: crypto.randomUUID(),
        bazar_id: activeBazar.id,
        product_id: product.id,
        quantity: requestedQuantity,
        payment_method: paymentMethod,
      })
      const sale = response.sale
      const soldItem = sale.items.find((item) => item.product_id === product.id)
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, stock: soldItem?.stock_after ?? Math.max(0, item.stock - requestedQuantity) }
            : item,
        ),
      )
      setSales((current) => [sale, ...current.filter((item) => item.id !== sale.id)].slice(0, 12))
      setConfirmation(sale)
      setQuantityProduct(null)
      if ('vibrate' in navigator) navigator.vibrate(70)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      confirmationTimer.current = setTimeout(() => setConfirmation(null), 9000)
      await Promise.all([loadActivity(activeBazar.id), loadSyncStatus()])
    } catch (saleError) {
      setError(getErrorMessage(saleError, 'No se pudo registrar la venta.'))
    } finally {
      setSellingProducts((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
    }
  }

  const undoSale = async (sale: Sale) => {
    setError(null)
    try {
      await apiClient.post(`/bazar/sales/${sale.id}/undo`)
      setConfirmation(null)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      await Promise.all([
        loadProducts(),
        loadActivity(activeBazarID),
        loadSyncStatus(),
      ])
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:min-w-64">
              <span className="sr-only">Bazar activo</span>
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={activeBazarID}
                onChange={(event) => setActiveBazarID(event.target.value)}
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

            {canSell && (
              <button
                type="button"
                onClick={() => setShowNewBazar(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </label>
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

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Catálogo</h2>
            <span className="text-sm text-muted-foreground">
              {visibleProducts.length} productos
            </span>
          </div>

          {visibleProducts.length === 0 ? (
            <EmptyCatalog
              hasProducts={products.length > 0}
              configured={syncStatus?.configured ?? false}
              onSync={() => void syncNow()}
              canSync={canSell}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  busy={sellingProducts.has(product.id)}
                  disabled={!canSell || !activeBazar}
                  onSell={() => void registerSale(product, 1)}
                  onMultiple={() => {
                    setQuantityProduct(product)
                    setQuantity(Math.min(2, product.stock))
                  }}
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
                <RecentSale key={sale.id} sale={sale} onUndo={() => void undoSale(sale)} canUndo={canSell} />
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

      {showNewBazar && canSell && (
        <NewBazarDialog
          creating={creatingBazar}
          canClose={bazaars.length > 0}
          onClose={() => setShowNewBazar(false)}
          onSubmit={createBazar}
        />
      )}

      {confirmation && (
        <SaleConfirmation
          sale={confirmation}
          onClose={() => setConfirmation(null)}
          onUndo={() => void undoSale(confirmation)}
        />
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
            ? `Google Sheets no está configurado. ${status.configuration_message || ''}`
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
  onSell,
  onMultiple,
}: {
  product: BazarProduct
  busy: boolean
  disabled: boolean
  onSell: () => void
  onMultiple: () => void
}) {
  const soldOut = product.stock === 0
  const lowStock = product.stock > 0 && product.stock <= 2
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
          soldOut
            ? 'bg-red-600 text-white'
            : lowStock
              ? 'bg-amber-400 text-amber-950'
              : 'bg-emerald-600 text-white'
        }`}>
          {soldOut ? 'Agotado' : lowStock ? `Quedan ${product.stock}` : `${product.stock} disponibles`}
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

        <div className="grid grid-cols-[1fr_42px] gap-2">
          <button
            type="button"
            onClick={onSell}
            disabled={unavailable}
            className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="truncate">{soldOut ? 'Agotado' : '+1 vendido'}</span>
          </button>
          <button
            type="button"
            onClick={onMultiple}
            disabled={unavailable}
            className="inline-flex h-11 w-[42px] items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            title="Vender varias unidades"
            aria-label={`Vender varias unidades de ${product.name}`}
          >
            <Layers3 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
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
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="quantity-title" className="w-full max-w-md rounded-t-md bg-background p-5 shadow-xl sm:rounded-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Venta de varias unidades</p>
            <h2 id="quantity-title" className="mt-1 text-xl font-semibold">{product.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-6 flex items-center justify-center gap-4">
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
            max={product.stock}
            value={quantity}
            onChange={(event) => onQuantityChange(Math.min(product.stock, Math.max(1, Number(event.target.value) || 1)))}
            className="h-14 w-24 rounded-md border border-input bg-background text-center text-2xl font-semibold"
            aria-label="Cantidad"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(product.stock, quantity + 1))}
            disabled={quantity >= product.stock}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            title="Agregar unidad"
            aria-label="Agregar unidad"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
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

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
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

function RecentSale({ sale, onUndo, canUndo }: { sale: Sale; onUndo: () => void; canUndo: boolean }) {
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
        <div className="shrink-0 text-right">
          <p className="font-semibold">{moneyFormatter.format(sale.total)}</p>
          {sale.status === 'cancelled' ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Cancelada</span>
          ) : canUndo ? (
            <button type="button" onClick={onUndo} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Undo2 className="h-3.5 w-3.5" />
              Deshacer
            </button>
          ) : null}
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
}: {
  sale: Sale
  onClose: () => void
  onUndo: () => void
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
          <div className="mt-3 flex items-center justify-between gap-3">
            <SyncDot status={sale.sync_status} />
            <button type="button" onClick={onUndo} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-sm font-medium hover:bg-emerald-900">
              <Undo2 className="h-4 w-4" />
              Deshacer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewBazarDialog({
  creating,
  canClose,
  onClose,
  onSubmit,
}: {
  creating: boolean
  canClose: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-t-md bg-background p-5 shadow-xl sm:rounded-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Jornada de ventas</p>
            <h2 className="mt-1 text-xl font-semibold">Iniciar bazar</h2>
          </div>
          {canClose && (
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
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
        </div>

        <button type="submit" disabled={creating} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
          Iniciar bazar
        </button>
      </form>
    </div>
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
            : 'Configura la conexión con Google Sheets en el backend.'}
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
