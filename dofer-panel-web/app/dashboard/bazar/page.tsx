'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  FileText,
  LoaderCircle,
  Maximize2,
  MapPin,
  Minimize2,
  PackagePlus,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  ScanLine,
  Search,
  ShoppingCart,
  Store,
  UserRound,
  WalletCards,
  WifiOff,
  X,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import {
  type StoredCombo,
  type StoredHeldSale,
  readCombos,
  readFavoriteProducts,
  readHeldSales,
  readLastPaymentMethod,
  readCashMode,
  readLastVariants,
  readProductSaleCounts,
  recordProductSales,
  requestPersistentStorage,
  writeCashMode,
  writeCombos,
  writeFavoriteProducts,
  writeHeldSales,
  writeLastPaymentMethod,
  writeLastVariant,
  writeOfflineProducts,
} from './_lib/pos-storage'
import {
  CloseBazarDialog,
  FinalizeBazarDialog,
  NewBazarDialog,
  ReportDialog,
} from './_components/bazar-dialogs'
import {
  EmptyCatalog,
  Metric,
  ProductCard,
  SyncNotice,
} from './_components/catalog'
import {
  CartDialog,
  QuantityDialog,
  QuickSaleDialog,
  ReceiptDialog,
  RecentSale,
  RepeatSaleDialog,
  SaleConfirmation,
} from './_components/pos'
import {
  ProductDialog,
  StockAdjustmentDialog,
} from './_components/product-dialogs'
import {
  ScannerDialog,
} from './_components/scanner'
import {
  OfflineQueueDialog,
  SyncConflictDialog,
} from './_components/sync-dialogs'
import {
  EMPTY_STATS,
  MAX_SALE_QUANTITY,
  MOVEMENT_OPTIONS,
  PAYMENT_METHODS,
} from './_lib/constants'
import {
  dateFormatter,
  localDateKey,
  moneyFormatter,
  syncLabel,
  timeFormatter,
} from './_lib/format'
import {
  imageFileToDataURL,
} from './_lib/images'
import {
  applyOfflineStock,
  countOfflineErrors,
  getOfflineProductQueue,
  isNetworkError,
  mergeActivityWithOffline,
  mergeOfflineProducts,
  readBazarCache,
  readOfflineSales,
  updateCachedBazaars,
  updateCachedProducts,
  writeBazarCache,
  writeOfflineSales,
} from './_lib/offline'
import {
  groupCatalogProducts,
  normalizeProductLookup,
  productDisplayName,
  productSaleLimit,
  productTracksStock,
} from './_lib/products'
import type {
  AuditLog,
  Bazar,
  BazarProduct,
  BazarReport,
  CurrentUser,
  DailyCut,
  DailyStats,
  InventoryMovement,
  OfflineProductEntry,
  OfflineSaleEntry,
  PaymentMethod,
  PosCheckoutInput,
  Sale,
  SalePayload,
  SaleResponse,
  StockFilter,
  SyncConflict,
  SyncStatus,
} from './_lib/types'

function exitFullscreenIfNeeded() {
  if (typeof document === 'undefined' || !document.fullscreenElement) return
  void document.exitFullscreen().catch(() => undefined)
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
  const [quantityProduct, setQuantityProduct] = useState<BazarProduct | null>(null)
  const [quantity, setQuantity] = useState(2)
  const [confirmation, setConfirmation] = useState<Sale | null>(null)
  const [repeatSale, setRepeatSale] = useState<Sale | null>(null)
  const [showNewBazar, setShowNewBazar] = useState(false)
  const [creatingBazar, setCreatingBazar] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [variantSeed, setVariantSeed] = useState<BazarProduct | null>(null)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [showQuickSale, setShowQuickSale] = useState(false)
  const [posInitialItems, setPosInitialItems] = useState<Record<string, number>>({})
  const [posSessionKey, setPosSessionKey] = useState(0)
  const [favoriteProducts, setFavoriteProducts] = useState<Set<string>>(new Set())
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [combos, setCombos] = useState<StoredCombo[]>([])
  const [heldSales, setHeldSales] = useState<StoredHeldSale[]>([])
  const [cashMode, setCashMode] = useState(false)
  const [editingProduct, setEditingProduct] = useState<BazarProduct | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<BazarProduct | null>(null)
  const [savingProduct, setSavingProduct] = useState(false)
  const [freeingProducts, setFreeingProducts] = useState<Set<string>>(new Set())
  const [saleCounts, setSaleCounts] = useState<Record<string, number>>({})
  // Día que se está consultando en pantalla; por defecto hoy.
  const [viewDate, setViewDate] = useState(() => localDateKey())
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [showCloseBazar, setShowCloseBazar] = useState(false)
  const [showFinalizeBazar, setShowFinalizeBazar] = useState(false)
  const [closingBazar, setClosingBazar] = useState(false)
  const [dailyCuts, setDailyCuts] = useState<DailyCut[]>([])
  const [showReport, setShowReport] = useState(false)
  const [report, setReport] = useState<BazarReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportDate, setReportDate] = useState(() => localDateKey())
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([])
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [offlineProductCount, setOfflineProductCount] = useState(0)
  const [offlineErrorCount, setOfflineErrorCount] = useState(0)
  const [showOfflineQueue, setShowOfflineQueue] = useState(false)
  const [flushingOffline, setFlushingOffline] = useState(false)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushingOfflineRef = useRef(false)
  const cashModeRef = useRef(false)
  const activityRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightSales = useRef(new Map<string, Promise<Sale | null>>())

  const activeBazar = useMemo(
    () => bazaars.find((item) => item.id === activeBazarID),
    [activeBazarID, bazaars],
  )
  const viewingToday = viewDate === localDateKey()
  const canSell = ['admin', 'operator'].includes(
    currentUser?.organization_role || currentUser?.role || '',
  )

  const updateCashMode = useCallback((enabled: boolean) => {
    cashModeRef.current = enabled
    setCashMode(enabled)
    writeCashMode(enabled)
  }, [])
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
      const favoriteDifference =
        Number(favoriteProducts.has(second.id)) - Number(favoriteProducts.has(first.id))
      if (favoriteDifference !== 0) return favoriteDifference
      const firstPosition = recentPosition.get(first.id) ?? Number.MAX_SAFE_INTEGER
      const secondPosition = recentPosition.get(second.id) ?? Number.MAX_SAFE_INTEGER
      if (firstPosition !== secondPosition) return firstPosition - secondPosition
      return first.name.localeCompare(second.name, 'es')
    })
  }, [favoriteProducts, products, sales])
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

  // El texto se escribe sin esperar al filtrado del catálogo: la lista se
  // recalcula con la última búsqueda estable en vez de con cada tecla.
  const deferredQuery = useDeferredValue(query)

  const visibleProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase('es')
    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLocaleLowerCase('es').includes(normalizedQuery) ||
        product.external_id.toLocaleLowerCase('es').includes(normalizedQuery) ||
        product.category.toLocaleLowerCase('es').includes(normalizedQuery) ||
        (product.variant_name || '').toLocaleLowerCase('es').includes(normalizedQuery)
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
  }, [products, category, deferredQuery, stockFilter])
  const visibleProductGroups = useMemo(
    () => groupCatalogProducts(visibleProducts),
    [visibleProducts],
  )
  const visibleVariantCount = useMemo(
    () => visibleProducts.filter((product) => product.variant_group_id).length,
    [visibleProducts],
  )

  const loadProducts = useCallback(async () => {
    const response = await apiClient.get<{ products: BazarProduct[] }>('/bazar/products')
    const serverProducts = response.products || []
    const nextProducts = applyOfflineStock(mergeOfflineProducts(serverProducts))
    setProducts(nextProducts)
    const cached = readBazarCache()
    if (cached) {
      writeBazarCache({
        ...cached,
        products: serverProducts,
        savedAt: new Date().toISOString(),
      })
    }
    return serverProducts
  }, [])

  const loadActivity = useCallback(async (bazarID: string, date = localDateKey()) => {
    if (!bazarID) {
      setSales([])
      setStats(EMPTY_STATS)
      return
    }
    const response = await apiClient.get<{ stats: DailyStats; sales: Sale[] }>(
      '/bazar/activity',
      { params: { bazar_id: bazarID, date, limit: 12 } },
    )
    const serverStats = response.stats || EMPTY_STATS
    const serverSales = response.sales || []
    const cached = readBazarCache()
    if (cached) {
      writeBazarCache({
        ...cached,
        activity: {
          ...(cached.activity || {}),
          [bazarID]: { date, sales: serverSales, stats: serverStats },
        },
        savedAt: new Date().toISOString(),
      })
    }
    const merged = mergeActivityWithOffline(serverStats, serverSales, bazarID, date)
    setStats(merged.stats)
    setSales(merged.sales)
  }, [])

  const loadSyncStatus = useCallback(async () => {
    const response = await apiClient.get<SyncStatus>('/bazar/sync/status')
    setSyncStatus(response)
    return response
  }, [])

  useEffect(() => {
    setFavoriteProducts(new Set(readFavoriteProducts()))
    setSelectedVariants(readLastVariants())
    setCombos(readCombos())
    setHeldSales(readHeldSales())
    const savedPaymentMethod = readLastPaymentMethod() as PaymentMethod
    if (PAYMENT_METHODS.some((method) => method.value === savedPaymentMethod)) {
      setPaymentMethod(savedPaymentMethod)
    }
    setOfflineProductCount(getOfflineProductQueue().length)
    setOfflineErrorCount(countOfflineErrors())
    setSaleCounts(readProductSaleCounts(localDateKey()))
    void requestPersistentStorage()
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/bazar-sw.js')
    }
  }, [])

  useEffect(() => {
    writeLastPaymentMethod(paymentMethod)
  }, [paymentMethod])

  useEffect(() => {
    setCashMode(readCashMode())
    cashModeRef.current = readCashMode()
  }, [])

  useEffect(() => {
    return () => {
      if (cashModeRef.current) exitFullscreenIfNeeded()
    }
  }, [])

  // Mientras el modo caja está activo la pantalla no se apaga: en un bazar el
  // equipo queda parado entre cliente y cliente y desbloquearlo cada vez es la
  // fricción más grande de la jornada. Hay que volver a pedir el permiso cada
  // vez que la pestaña regresa, porque el sistema lo suelta al ocultarla.
  useEffect(() => {
    if (!cashMode || typeof navigator === 'undefined' || !navigator.wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = async () => {
      if (released || document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Sin permiso el modo caja funciona igual, solo se apaga la pantalla.
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', handleVisibility)
      void sentinel?.release().catch(() => undefined)
    }
  }, [cashMode])

  const selectActiveBazar = useCallback((availableBazaars: Bazar[]) => {
    const storedBazarID = localStorage.getItem('dofer-active-bazar-id')
    const selected =
      availableBazaars.find(
        (item) => item.id === storedBazarID && item.status === 'active',
      ) || availableBazaars.find((item) => item.status === 'active')
    if (!selected) return
    setActiveBazarID(selected.id)
    const savedPaymentMethod = readLastPaymentMethod() as PaymentMethod
    setPaymentMethod(
      PAYMENT_METHODS.some((method) => method.value === savedPaymentMethod)
        ? savedPaymentMethod
        : selected.default_payment_method,
    )
  }, [])

  // La sincronización con Google Sheets puede tardar varios segundos, así que
  // corre detrás del catálogo en vez de retrasar la apertura del punto de venta.
  const syncSheetsInBackground = useCallback(async () => {
    setSyncing(true)
    try {
      const conflictResponse = await apiClient.get<{ conflicts: SyncConflict[] }>('/bazar/sync/conflicts')
      if ((conflictResponse.conflicts || []).length > 0) {
        setSyncConflicts(conflictResponse.conflicts)
        return
      }
      await apiClient.post('/bazar/sync', { conflict_strategy: '' })
      await Promise.all([loadProducts(), loadSyncStatus()])
    } catch (syncError) {
      if (!isNetworkError(syncError)) {
        setError(getErrorMessage(syncError, 'No se pudo sincronizar Google Sheets.'))
      }
    } finally {
      setSyncing(false)
    }
  }, [loadProducts, loadSyncStatus])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setError(null)

      // Arranque inmediato con lo último que quedó guardado en el dispositivo;
      // los datos frescos entran detrás sin dejar el punto de venta en blanco.
      const cached = readBazarCache()
      if (cached) {
        setProducts(applyOfflineStock(mergeOfflineProducts(cached.products)))
        setBazaars(cached.bazaars)
        setCurrentUser(cached.currentUser)
        setSyncStatus(cached.syncStatus)
        selectActiveBazar(cached.bazaars)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setOfflineQueueCount(readOfflineSales().length)
      setOfflineProductCount(getOfflineProductQueue().length)
      setOfflineErrorCount(countOfflineErrors())

      try {
        const [bazarResponse, userResponse, currentSyncStatus, loadedProducts] =
          await Promise.all([
            apiClient.get<{ bazaars: Bazar[] }>('/bazar/bazaars'),
            apiClient.get<CurrentUser>('/auth/me'),
            loadSyncStatus(),
            loadProducts(),
          ])
        if (cancelled) return

        const availableBazaars = bazarResponse.bazaars || []
        setBazaars(availableBazaars)
        setCurrentUser(userResponse)
        selectActiveBazar(availableBazaars)

        const previousCache = readBazarCache()
        writeBazarCache({
          products: loadedProducts,
          bazaars: availableBazaars,
          currentUser: userResponse,
          syncStatus: currentSyncStatus,
          activity: previousCache?.activity,
          savedAt: new Date().toISOString(),
        })
        setOfflineQueueCount(readOfflineSales().length)
        setOfflineProductCount(getOfflineProductQueue().length)
        setOfflineErrorCount(countOfflineErrors())

        const lastSync = currentSyncStatus.last_product_sync
          ? new Date(currentSyncStatus.last_product_sync).getTime()
          : 0
        const needsRefresh =
          currentSyncStatus.configured && Date.now() - lastSync > 5 * 60 * 1000
        if (
          needsRefresh &&
          ['admin', 'operator'].includes(
            userResponse.organization_role || userResponse.role,
          )
        ) {
          void syncSheetsInBackground()
        }
      } catch (loadError) {
        if (cancelled) return
        if (!cached || !isNetworkError(loadError)) {
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
      if (activityRefreshTimer.current) clearTimeout(activityRefreshTimer.current)
    }
  }, [loadProducts, loadSyncStatus, selectActiveBazar, syncSheetsInBackground])

  useEffect(() => {
    if (!activeBazarID) return
    localStorage.setItem('dofer-active-bazar-id', activeBazarID)

    const activityTimer = window.setTimeout(() => {
      void loadActivity(activeBazarID, viewDate).catch((activityError) => {
        if (isNetworkError(activityError)) {
          const cachedActivity = readBazarCache()?.activity?.[activeBazarID]
          const sameDay = cachedActivity?.date === viewDate
          const merged = mergeActivityWithOffline(
            sameDay ? cachedActivity.stats : EMPTY_STATS,
            sameDay ? cachedActivity.sales : [],
            activeBazarID,
            viewDate,
          )
          setSales(merged.sales)
          setStats(merged.stats)
          return
        }
        setError(getErrorMessage(activityError, 'No se pudo cargar la actividad del día.'))
      })
    }, 0)
    return () => window.clearTimeout(activityTimer)
  }, [activeBazarID, loadActivity, viewDate])

  const performSync = async (conflictStrategy?: 'keep_manual' | 'use_sheet') => {
    setSyncing(true)
    setError(null)
    try {
      await apiClient.post('/bazar/sync', {
        conflict_strategy: conflictStrategy || '',
      })
      setSyncConflicts([])
      await Promise.all([loadProducts(), loadSyncStatus(), loadActivity(activeBazarID, viewDate)])
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

  // El resumen del día se recarga una sola vez cuando ya no quedan ventas
  // viajando al servidor: así varias ventas seguidas no disparan una cascada
  // de peticiones ni borran las que aún se están confirmando.
  const scheduleActivityRefresh = (bazarID: string) => {
    if (activityRefreshTimer.current) clearTimeout(activityRefreshTimer.current)
    activityRefreshTimer.current = setTimeout(() => {
      if (inFlightSales.current.size > 0) return
      void Promise.all([loadActivity(bazarID, viewDate), loadSyncStatus()]).catch(() => undefined)
    }, 1200)
  }

  const submitSale = (
    requestedItems: Array<{ product: BazarProduct; quantity: number }>,
    method: PaymentMethod,
    cashReceived?: number,
    saleDate?: string,
  ) => {
    if (!activeBazar || !canSell || requestedItems.length === 0) return null
    for (const item of requestedItems) {
      if (item.quantity <= 0 || item.quantity > MAX_SALE_QUANTITY) {
        setError('La cantidad debe estar entre 1 y 999.')
        return null
      }
      if (productTracksStock(item.product) && item.quantity > item.product.stock) {
        setError(`Solo hay ${item.product.stock} unidades disponibles de ${productDisplayName(item.product)}.`)
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
      ...(method === 'cash' && cashReceived !== undefined
        ? { cash_received: cashReceived }
        : {}),
      ...(saleDate ? { sold_at: saleDate } : {}),
    }

    // La venta solo mueve el resumen y la lista si pertenece al día que se
    // está viendo; el ranking de más vendidos solo cuenta lo de hoy.
    const saleDayKey = saleDate || localDateKey()
    const showsInView = saleDayKey === viewDate
    const countsForToday = saleDayKey === localDateKey()
    const createdAt = new Date().toISOString()
    const soldAt = saleDate ? `${saleDate}T12:00:00` : createdAt
    const total = requestedItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    )
    const units = requestedItems.reduce((sum, item) => sum + item.quantity, 0)
    const localSale: Sale = {
      id: `offline-${payload.client_request_id}`,
      external_id: `PEND-${payload.client_request_id.slice(0, 8).toUpperCase()}`,
      client_request_id: payload.client_request_id,
      bazar_id: activeBazar.id,
      bazar_name: activeBazar.name,
      seller_name: currentUser?.full_name || currentUser?.email || 'Vendedor',
      total,
      payment_method: method,
      cash_received: method === 'cash' ? cashReceived : undefined,
      change_due:
        method === 'cash' && cashReceived !== undefined
          ? Math.max(0, cashReceived - total)
          : undefined,
      status: 'completed',
      sync_status: 'pending',
      sold_at: soldAt,
      created_at: createdAt,
      items: requestedItems.map((item) => ({
        product_id: item.product.id,
        product_external_id: item.product.external_id,
        product_name: productDisplayName(item.product),
        quantity: item.quantity,
        unit_price: item.product.price,
        total: item.product.price * item.quantity,
        stock_before: item.product.stock,
        stock_after: productTracksStock(item.product)
          ? item.product.stock - item.quantity
          : item.product.stock,
      })),
    }

    // La venta se pinta en pantalla antes de tocar la red para poder anotar
    // la siguiente de inmediato; el servidor confirma en segundo plano.
    const applyOptimisticSale = (pendingSync: boolean) => {
      setProducts((current) =>
        current.map((product) => {
          const sold = requestedItems.find((item) => item.product.id === product.id)
          return sold && productTracksStock(product)
            ? { ...product, stock: product.stock - sold.quantity }
            : product
        }),
      )
      if (countsForToday) {
        setSaleCounts(
          recordProductSales(
            localDateKey(),
            requestedItems.map((item) => ({
              product_id: item.product.id,
              quantity: item.quantity,
            })),
          ),
        )
      }
      if (!showsInView) {
        if (pendingSync) {
          setStats((current) => ({
            ...current,
            pending_sync: current.pending_sync + 1,
          }))
        }
        showSaleConfirmation(localSale)
        return
      }
      setSales((current) => [localSale, ...current].slice(0, 12))
      setStats((current) => {
        const operations = current.operations + 1
        const nextTotal = current.total + localSale.total
        return {
          ...current,
          total: nextTotal,
          products_sold: current.products_sold + units,
          operations,
          average_ticket: nextTotal / operations,
          pending_sync: current.pending_sync + (pendingSync ? 1 : 0),
          last_sale_at: soldAt,
        }
      })
      showSaleConfirmation(localSale)
    }

    const revertOptimisticSale = () => {
      setProducts((current) =>
        current.map((product) => {
          const sold = requestedItems.find((item) => item.product.id === product.id)
          return sold && productTracksStock(product)
            ? { ...product, stock: product.stock + sold.quantity }
            : product
        }),
      )
      setConfirmation((current) => (current?.id === localSale.id ? null : current))
      if (!showsInView) return
      setSales((current) => current.filter((item) => item.id !== localSale.id))
      setStats((current) => {
        const operations = Math.max(0, current.operations - 1)
        const nextTotal = Math.max(0, current.total - localSale.total)
        return {
          ...current,
          total: nextTotal,
          products_sold: Math.max(0, current.products_sold - units),
          operations,
          average_ticket: operations > 0 ? nextTotal / operations : 0,
        }
      })
    }

    const queueSaleLocally = () => {
      const queued = [{ payload, sale: localSale, attempts: 0 }, ...readOfflineSales()]
      if (!writeOfflineSales(queued)) {
        setError('No hay espacio disponible en el dispositivo para guardar la venta sin conexión.')
        return false
      }
      setOfflineQueueCount(queued.length)
      setOfflineErrorCount(countOfflineErrors())
      return true
    }

    setError(null)
    const pendingProductIDs = new Set(
      getOfflineProductQueue().map((entry) => entry.product.id),
    )
    if (
      !navigator.onLine ||
      requestedItems.some((item) => pendingProductIDs.has(item.product.id))
    ) {
      if (!queueSaleLocally()) return null
      applyOptimisticSale(true)
      return localSale
    }

    applyOptimisticSale(false)

    const request = (async () => {
      try {
        const response = await apiClient.post<SaleResponse>('/bazar/sales', payload)
        const sale = response.sale
        const stockByProduct = new Map(
          sale.items.map((item) => [item.product_id, item.stock_after]),
        )
        updateCachedProducts((cachedProducts) =>
          cachedProducts.map((product) =>
            stockByProduct.has(product.id)
              ? { ...product, stock: stockByProduct.get(product.id) ?? product.stock }
              : product,
          ),
        )
        setProducts((current) =>
          current.map((product) =>
            stockByProduct.has(product.id)
              ? { ...product, stock: stockByProduct.get(product.id) ?? product.stock }
              : product,
          ),
        )
        if (showsInView) {
          setSales((current) =>
            [
              sale,
              ...current.filter((item) => item.id !== sale.id && item.id !== localSale.id),
            ].slice(0, 12),
          )
        }
        setConfirmation((current) => (current?.id === localSale.id ? sale : current))
        return sale
      } catch (saleError) {
        if (isNetworkError(saleError)) {
          if (queueSaleLocally()) {
            setStats((current) => ({ ...current, pending_sync: current.pending_sync + 1 }))
          } else {
            revertOptimisticSale()
          }
          return null
        }
        revertOptimisticSale()
        setError(getErrorMessage(saleError, 'No se pudo registrar la venta.'))
        return null
      } finally {
        inFlightSales.current.delete(payload.client_request_id)
        scheduleActivityRefresh(activeBazar.id)
      }
    })()

    inFlightSales.current.set(payload.client_request_id, request)
    return localSale
  }

  const registerSale = (product: BazarProduct, requestedQuantity: number) => {
    submitSale([{ product, quantity: requestedQuantity }], paymentMethod)
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

  const submitCartSale = () => {
    if (submitSale(cartProducts, paymentMethod)) {
      setCart({})
      setShowCart(false)
    }
  }

  const createPosProduct = async (input: {
    name: string
    category: string
    price: number
  }) => {
    const normalizedName = normalizeProductLookup(input.name)
    const existing =
      products.find(
        (item) =>
          normalizeProductLookup(item.name) === normalizedName ||
          normalizeProductLookup(item.external_id) === normalizedName,
      ) || null
    if (existing) return existing

    const id = crypto.randomUUID()
    const sku = `MAN-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`
    const payload = {
      id,
      sku,
      name: input.name.trim(),
      category: input.category.trim(),
      price: input.price,
      stock: 0,
      track_stock: false,
    }
    const localProduct: BazarProduct = {
      id,
      external_id: sku,
      name: payload.name,
      category: payload.category,
      price: payload.price,
      stock: 0,
      track_stock: false,
      active: true,
      source: 'manual',
      stock_sync_policy: 'manual',
    }

    const queueProduct = (message?: string) => {
      const queue = getOfflineProductQueue()
      const next = [
        {
          payload,
          product: localProduct,
          operation: 'create' as const,
          attempts: 0,
          last_error: message,
        },
        ...queue.filter((entry) => entry.product.id !== id),
      ]
      if (!writeOfflineProducts(next)) {
        setError('No hay espacio disponible para guardar el producto sin conexión.')
        return null
      }
      setProducts((current) => [
        localProduct,
        ...current.filter((product) => product.id !== localProduct.id),
      ])
      setOfflineProductCount(next.length)
      setOfflineErrorCount(countOfflineErrors())
      return localProduct
    }

    setError(null)
    if (!navigator.onLine) return queueProduct()
    try {
      const created = await apiClient.post<BazarProduct>('/bazar/products', payload)
      updateCachedProducts((cachedProducts) => [
        created,
        ...cachedProducts.filter((product) => product.id !== created.id),
      ])
      setProducts((current) => [
        created,
        ...current.filter((product) => product.id !== created.id),
      ])
      return created
    } catch (productError) {
      if (isNetworkError(productError)) {
        return queueProduct(getErrorMessage(productError, 'Conexión interrumpida.'))
      }
      setError(getErrorMessage(productError, 'No se pudo guardar el producto.'))
      return null
    }
  }

  const submitPosSale = (input: PosCheckoutInput) => {
    if (!activeBazar) return false
    const sale = submitSale(
      input.items,
      input.paymentMethod,
      input.cashReceived,
      input.saleDate,
    )
    if (!sale) return false
    setPaymentMethod(input.paymentMethod)
    writeLastPaymentMethod(input.paymentMethod)
    if (!input.keepOpen) setShowQuickSale(false)
    return true
  }

  const openPos = useCallback((items: Record<string, number> = {}) => {
    setPosInitialItems(items)
    setPosSessionKey((current) => current + 1)
    setShowQuickSale(true)
  }, [])

  const toggleFavoriteProduct = (productID: string) => {
    setFavoriteProducts((current) => {
      const next = new Set(current)
      if (next.has(productID)) next.delete(productID)
      else next.add(productID)
      writeFavoriteProducts([...next])
      return next
    })
  }

  const selectVariant = (groupID: string, productID: string) => {
    setSelectedVariants((current) => ({ ...current, [groupID]: productID }))
    writeLastVariant(groupID, productID)
  }

  const saveCombo = (name: string, items: Record<string, number>) => {
    const next: StoredCombo[] = [
      {
        id: crypto.randomUUID(),
        name,
        items: Object.entries(items)
          .filter(([, itemQuantity]) => itemQuantity > 0)
          .map(([productID, itemQuantity]) => ({
            product_id: productID,
            quantity: itemQuantity,
          })),
        created_at: new Date().toISOString(),
      },
      ...combos,
    ]
    writeCombos(next)
    setCombos(next)
  }

  const deleteCombo = (comboID: string) => {
    const next = combos.filter((combo) => combo.id !== comboID)
    writeCombos(next)
    setCombos(next)
  }

  const holdSale = (items: Record<string, number>, method: PaymentMethod) => {
    const next: StoredHeldSale[] = [
      {
        id: crypto.randomUUID(),
        name: `Pendiente ${heldSales.length + 1}`,
        items: Object.entries(items)
          .filter(([, itemQuantity]) => itemQuantity > 0)
          .map(([productID, itemQuantity]) => ({
            product_id: productID,
            quantity: itemQuantity,
          })),
        payment_method: method,
        created_at: new Date().toISOString(),
      },
      ...heldSales,
    ]
    writeHeldSales(next)
    setHeldSales(next)
  }

  const deleteHeldSale = (saleID: string) => {
    const next = heldSales.filter((sale) => sale.id !== saleID)
    writeHeldSales(next)
    setHeldSales(next)
  }

  const confirmRepeatSale = (lastSale: Sale) => {
    const items: Record<string, number> = {}
    for (const item of lastSale.items) {
      const product = products.find((candidate) => candidate.id === item.product_id)
      if (!product?.active) continue
      const availableQuantity = Math.min(item.quantity, productSaleLimit(product))
      if (availableQuantity > 0) items[product.id] = availableQuantity
    }
    if (Object.keys(items).length === 0) {
      setError('Los productos de la última venta ya no están disponibles.')
      setRepeatSale(null)
      return
    }
    setRepeatSale(null)
    openPos(items)
  }

  // El modo caja no depende de la pantalla completa del navegador: en iPadOS
  // no siempre está disponible, y ahí Escape la cierra siempre. Se pide como
  // extra cuando existe, pero salir de ella ya no apaga el modo.
  const toggleCashMode = async () => {
    const next = !cashMode
    updateCashMode(next)
    try {
      if (next && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // Sin pantalla completa el modo caja funciona igual.
    }
  }

  const leaveCashModeForProduct = (product: BazarProduct, action: 'edit' | 'stock') => {
    if (cashMode) {
      updateCashMode(false)
      exitFullscreenIfNeeded()
    }
    if (action === 'edit') setEditingProduct(product)
    else setAdjustingProduct(product)
  }

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (event.key === 'F2' && activeBazarID && canSell && !showQuickSale) {
        event.preventDefault()
        openPos()
      }
    }
    window.addEventListener('keydown', handleGlobalShortcut)
    return () => window.removeEventListener('keydown', handleGlobalShortcut)
  }, [activeBazarID, canSell, openPos, showQuickSale])

  const flushOfflineSales = useCallback(async () => {
    if (flushingOfflineRef.current || !navigator.onLine) return
    const productQueue = getOfflineProductQueue()
    const saleQueue = readOfflineSales()
    if (productQueue.length === 0 && saleQueue.length === 0) {
      setOfflineQueueCount(0)
      setOfflineProductCount(0)
      setOfflineErrorCount(0)
      return
    }

    flushingOfflineRef.current = true
    setFlushingOffline(true)
    const pendingProducts: OfflineProductEntry[] = []
    const syncedProducts: BazarProduct[] = []
    const pendingSales: OfflineSaleEntry[] = []
    try {
      for (const entry of [...productQueue].reverse()) {
        try {
          const product =
            entry.operation === 'update'
              ? await apiClient.put<BazarProduct>(
                  `/bazar/products/${entry.product.id}`,
                  entry.payload,
                )
              : await apiClient.post<BazarProduct>('/bazar/products', entry.payload)
          syncedProducts.push(product)
        } catch (syncError) {
          pendingProducts.unshift({
            ...entry,
            attempts: entry.attempts + 1,
            last_error: getErrorMessage(syncError, 'No se pudo sincronizar el producto.'),
          })
        }
      }
      if (!writeOfflineProducts(pendingProducts)) {
        setError('No se pudo actualizar la cola local. Libera espacio en el dispositivo e inténtalo de nuevo.')
        return
      }

      if (syncedProducts.length > 0) {
        setProducts((current) => {
          const syncedByID = new Map(syncedProducts.map((product) => [product.id, product]))
          return current.map((product) => syncedByID.get(product.id) || product)
        })
      }

      const blockedProductIDs = new Set(
        pendingProducts.map((entry) => entry.product.id),
      )
      for (const entry of [...saleQueue].reverse()) {
        if (entry.payload.items.some((item) => blockedProductIDs.has(item.product_id))) {
          pendingSales.unshift({
            ...entry,
            last_error: 'Esperando la sincronización de un producto.',
          })
          continue
        }
        try {
          await apiClient.post<SaleResponse>('/bazar/sales', entry.payload)
        } catch (syncError) {
          pendingSales.unshift({
            ...entry,
            attempts: (entry.attempts || 0) + 1,
            last_error: getErrorMessage(syncError, 'No se pudo sincronizar la venta.'),
          })
        }
      }
      if (!writeOfflineSales(pendingSales)) {
        setError('No se pudo actualizar la cola local. Libera espacio en el dispositivo e inténtalo de nuevo.')
        return
      }

      setOfflineProductCount(pendingProducts.length)
      setOfflineQueueCount(pendingSales.length)
      setOfflineErrorCount(countOfflineErrors())
      if (pendingProducts.length === 0 && pendingSales.length === 0) {
        await Promise.all([loadProducts(), loadActivity(activeBazarID, viewDate), loadSyncStatus()])
      } else {
        setError(`Quedaron ${pendingProducts.length + pendingSales.length} operaciones sin enviar. Se volverá a intentar.`)
      }
    } finally {
      flushingOfflineRef.current = false
      setFlushingOffline(false)
    }
  }, [activeBazarID, loadActivity, loadProducts, loadSyncStatus, viewDate])

  useEffect(() => {
    const handleOnline = () => void flushOfflineSales()
    window.addEventListener('online', handleOnline)
    const initialRetry = window.setTimeout(() => {
      if (
        navigator.onLine &&
        (readOfflineSales().length > 0 || getOfflineProductQueue().length > 0)
      ) {
        void flushOfflineSales()
      }
    }, 0)
    return () => {
      window.clearTimeout(initialRetry)
      window.removeEventListener('online', handleOnline)
    }
  }, [flushOfflineSales])

  const undoSale = async (sale: Sale) => {
    setError(null)
    // La venta pudo registrarse en pantalla mientras todavía viajaba al
    // servidor: se espera su confirmación para cancelarla del lado correcto.
    const inFlight = inFlightSales.current.get(sale.client_request_id)
    const target = inFlight ? (await inFlight) || sale : sale

    if (target.id.startsWith('offline-')) {
      const queue = readOfflineSales()
      const entry = queue.find((item) => item.sale.client_request_id === target.client_request_id)
      const next = queue.filter((item) => item.sale.client_request_id !== target.client_request_id)
      if (!writeOfflineSales(next)) {
        setError('No se pudo actualizar la cola local de ventas.')
        return
      }
      setOfflineQueueCount(next.length)
      setOfflineErrorCount(countOfflineErrors())
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
      setSales((current) => current.filter((item) => item.id !== target.id))
      setConfirmation(null)
      return
    }

    try {
      await apiClient.post(`/bazar/sales/${target.id}/undo`)
      setConfirmation(null)
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
      await Promise.all([loadProducts(), loadActivity(activeBazarID, viewDate), loadSyncStatus()])
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
      updateCachedBazaars((cachedBazaars) => [
        created,
        ...cachedBazaars.filter((bazar) => bazar.id !== created.id),
      ])
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
      const productMode = String(form.get('product_mode') || 'single')

      if (productMode === 'variants') {
        const variantIDs = String(form.get('variant_ids') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
        if (variantIDs.length === 0) {
          throw new Error('Agrega al menos una variante.')
        }

        const groupID = variantSeed?.variant_group_id || crypto.randomUUID()
        const name = String(form.get('name') || variantSeed?.name || '').trim()
        const category = String(
          form.get('category') || variantSeed?.category || '',
        ).trim()
        const commonPrice = Number(form.get('price'))
        const commonImage =
          uploadedImage || String(form.get('image_url') || '')
        const localVariants = variantIDs.map((variantID, variantIndex) => {
          const id = crypto.randomUUID()
          const rawSKU = String(form.get(`variant_sku_${variantID}`) || '').trim()
          const rawPrice = String(form.get(`variant_price_${variantID}`) || '').trim()
          const price = rawPrice === '' ? commonPrice : Number(rawPrice)
          // Sin stock capturado la variante se vende libre: así se puede
          // cobrar de inmediato y contar existencias después.
          const rawStock = String(form.get(`variant_stock_${variantID}`) || '').trim()
          const tracksStock = rawStock !== ''
          const payload = {
            id,
            sku: rawSKU || `MAN-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`,
            name,
            category,
            price,
            stock: tracksStock ? Number(rawStock) : 0,
            track_stock: tracksStock,
            image_url:
              variantSeed || variantIndex === 0 ? commonImage : '',
            variant_group_id: groupID,
            variant_name: String(
              form.get(`variant_name_${variantID}`) || '',
            ).trim(),
            variant_color: String(
              form.get(`variant_color_${variantID}`) || '',
            ).toUpperCase(),
          }
          if (!payload.variant_name) {
            throw new Error('Escribe el nombre de cada variante.')
          }
          const product: BazarProduct = {
            id,
            external_id: payload.sku,
            name: payload.name,
            category: payload.category,
            price: payload.price,
            stock: payload.stock,
            track_stock: tracksStock,
            image_url: payload.image_url,
            active: true,
            source: 'manual',
            stock_sync_policy: 'manual',
            variant_group_id: groupID,
            variant_name: payload.variant_name,
            variant_color: payload.variant_color,
          }
          return { payload, product }
        })

        const currentQueue = getOfflineProductQueue()
        const queuedIDs = new Set(localVariants.map((entry) => entry.product.id))
        const nextEntries: OfflineProductEntry[] = localVariants.map((entry) => ({
          ...entry,
          operation: 'create',
          attempts: 0,
        }))
        let convertedSeed: BazarProduct | null = null

        if (variantSeed && !variantSeed.variant_group_id) {
          const seedUpdates = {
            sku: variantSeed.external_id,
            name,
            category,
            price: variantSeed.price,
            image_url: variantSeed.image_url || '',
            active: variantSeed.active,
            stock_sync_policy: variantSeed.stock_sync_policy || 'manual',
            variant_group_id: groupID,
            variant_name: String(form.get('current_variant_name') || '').trim(),
            variant_color: String(
              form.get('current_variant_color') || '',
            ).toUpperCase(),
          }
          if (!seedUpdates.variant_name) {
            throw new Error('Escribe la variante del producto actual.')
          }
          convertedSeed = {
            ...variantSeed,
            name,
            category,
            variant_group_id: groupID,
            variant_name: seedUpdates.variant_name,
            variant_color: seedUpdates.variant_color,
          }
          const existingEntry = currentQueue.find(
            (entry) => entry.product.id === variantSeed.id,
          )
          nextEntries.push(
            existingEntry
              ? {
                  ...existingEntry,
                  payload: { ...existingEntry.payload, ...seedUpdates },
                  product: convertedSeed,
                  attempts: 0,
                  last_error: undefined,
                }
              : {
                  payload: seedUpdates,
                  product: convertedSeed,
                  operation: 'update',
                  attempts: 0,
                },
          )
          queuedIDs.add(variantSeed.id)
        }

        const nextQueue = [
          ...nextEntries,
          ...currentQueue.filter((entry) => !queuedIDs.has(entry.product.id)),
        ]
        if (!writeOfflineProducts(nextQueue)) {
          throw new Error('No hay espacio disponible para guardar las variantes.')
        }
        setProducts((current) => [
          ...localVariants.map((entry) => entry.product),
          ...current.map((product) =>
            convertedSeed && product.id === convertedSeed.id
              ? convertedSeed
              : product,
          ),
        ])
        setSelectedVariants((current) => ({
          ...current,
          [groupID]: convertedSeed?.id || localVariants[0].product.id,
        }))
        writeLastVariant(groupID, convertedSeed?.id || localVariants[0].product.id)
        setOfflineProductCount(nextQueue.length)
        setOfflineErrorCount(countOfflineErrors())
        setQuery('')
        setCategory('Todos')
        setStockFilter('all')
        setShowNewProduct(false)
        setVariantSeed(null)
        if (navigator.onLine) {
          window.setTimeout(() => void flushOfflineSales(), 0)
        }
        return
      }

      const id = crypto.randomUUID()
      const rawSKU = String(form.get('sku') || '').trim()
      // Igual que en las variantes: sin stock inicial el producto se vende
      // libre en vez de quedar bloqueado en cero.
      const rawStock = String(form.get('stock') || '').trim()
      const tracksStock = rawStock !== ''
      const payload = {
        id,
        sku: rawSKU || `MAN-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`,
        name: String(form.get('name') || '').trim(),
        category: String(form.get('category') || '').trim(),
        price: Number(form.get('price')),
        stock: tracksStock ? Number(rawStock) : 0,
        track_stock: tracksStock,
        image_url: uploadedImage || String(form.get('image_url') || ''),
      }
      const localProduct: BazarProduct = {
        id,
        external_id: payload.sku,
        name: payload.name,
        category: payload.category,
        price: payload.price,
        stock: payload.stock,
        track_stock: tracksStock,
        image_url: payload.image_url,
        active: true,
        source: 'manual',
        stock_sync_policy: 'manual',
      }
      let created = localProduct
      if (navigator.onLine) {
        try {
          created = await apiClient.post<BazarProduct>('/bazar/products', payload)
        } catch (productError) {
          if (!isNetworkError(productError)) throw productError
          const queued = [
            {
              payload,
              product: localProduct,
              operation: 'create' as const,
              attempts: 0,
              last_error: getErrorMessage(productError, 'Conexión interrumpida.'),
            },
            ...getOfflineProductQueue(),
          ]
          if (!writeOfflineProducts(queued)) {
            throw new Error('No hay espacio disponible para guardar el producto sin conexión.')
          }
          setOfflineProductCount(queued.length)
          setOfflineErrorCount(countOfflineErrors())
        }
      } else {
        const queued = [
          { payload, product: localProduct, operation: 'create' as const, attempts: 0 },
          ...getOfflineProductQueue(),
        ]
        if (!writeOfflineProducts(queued)) {
          throw new Error('No hay espacio disponible para guardar el producto sin conexión.')
        }
        setOfflineProductCount(queued.length)
      }
      if (!getOfflineProductQueue().some((entry) => entry.product.id === created.id)) {
        updateCachedProducts((cachedProducts) => [
          created,
          ...cachedProducts.filter((product) => product.id !== created.id),
        ])
      }
      setProducts((current) => [created, ...current.filter((product) => product.id !== created.id)])
      setQuery('')
      setCategory('Todos')
      setStockFilter('all')
      setShowNewProduct(false)
      setVariantSeed(null)
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
      const variantUpdates = editingProduct.variant_group_id
        ? {
            variant_group_id: editingProduct.variant_group_id,
            variant_name: String(
              form.get('variant_name') || editingProduct.variant_name || '',
            ).trim(),
            variant_color: String(
              form.get('variant_color') || editingProduct.variant_color || '',
            ).toUpperCase(),
          }
        : {}
      const updates = {
        sku: String(form.get('sku') || '').trim(),
        name: String(form.get('name') || '').trim(),
        category: String(form.get('category') || '').trim(),
        price: Number(form.get('price')),
        image_url: removeImage
          ? ''
          : uploadedImage || String(form.get('image_url') || '') || editingProduct.image_url || '',
        active: form.get('active') === 'on',
        stock_sync_policy: String(form.get('stock_sync_policy') || 'manual'),
        ...variantUpdates,
      }
      const offlineProducts = getOfflineProductQueue()
      const offlineEntry = offlineProducts.find(
        (entry) => entry.product.id === editingProduct.id,
      )
      const edited: BazarProduct = {
        ...editingProduct,
        external_id: updates.sku,
        name: updates.name,
        category: updates.category,
        price: updates.price,
        image_url: updates.image_url,
        active: updates.active,
        stock_sync_policy: updates.stock_sync_policy as 'manual' | 'sheets',
        ...variantUpdates,
      }
      const queueUpdate = (message?: string) => {
        const nextEntry: OfflineProductEntry = offlineEntry
          ? {
              ...offlineEntry,
              payload:
                offlineEntry.operation === 'update'
                  ? { ...offlineEntry.payload, ...updates }
                  : {
                      ...offlineEntry.payload,
                      sku: updates.sku,
                      name: updates.name,
                      category: updates.category,
                      price: updates.price,
                      image_url: updates.image_url,
                    },
              product: edited,
              attempts: 0,
              last_error: message,
            }
          : {
              payload: updates,
              product: edited,
              operation: 'update',
              attempts: 0,
              last_error: message,
            }
        const next = [
          nextEntry,
          ...offlineProducts.filter((entry) => entry.product.id !== edited.id),
        ]
        if (!writeOfflineProducts(next)) {
          throw new Error('No se pudo actualizar el producto guardado en este dispositivo.')
        }
        setProducts((current) =>
          current.map((product) => (product.id === edited.id ? edited : product)),
        )
        setOfflineProductCount(next.length)
        setOfflineErrorCount(countOfflineErrors())
        setEditingProduct(null)
      }
      if (offlineEntry || !navigator.onLine) {
        queueUpdate()
        if (offlineEntry && navigator.onLine) {
          window.setTimeout(() => void flushOfflineSales(), 0)
        }
        return
      }
      let savedProduct: BazarProduct
      try {
        savedProduct = await apiClient.put<BazarProduct>(
          `/bazar/products/${editingProduct.id}`,
          updates,
        )
      } catch (updateError) {
        if (!isNetworkError(updateError)) throw updateError
        queueUpdate(getErrorMessage(updateError, 'Conexión interrumpida.'))
        return
      }
      updateCachedProducts((cachedProducts) =>
        cachedProducts.map((product) =>
          product.id === savedProduct.id ? savedProduct : product,
        ),
      )
      setProducts((current) =>
        current.map((product) =>
          product.id === savedProduct.id ? savedProduct : product,
        ),
      )
      setEditingProduct(null)
    } catch (updateError) {
      setError(getErrorMessage(updateError, 'No se pudo actualizar el producto.'))
    } finally {
      setSavingProduct(false)
    }
  }

  // Un producto con control de inventario y existencia en cero queda
  // bloqueado para vender. Esto lo pasa a venta libre sin obligar a inventariar
  // en plena venta; el conteo se puede reactivar después desde el ajuste.
  const enableFreeSale = async (product: BazarProduct) => {
    if (!canSell || freeingProducts.has(product.id)) return
    setFreeingProducts((current) => new Set(current).add(product.id))
    setError(null)

    const optimistic = { ...product, track_stock: false }
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? optimistic : item)),
    )

    try {
      const updated = await apiClient.put<BazarProduct>(
        `/bazar/products/${product.id}`,
        { track_stock: false },
      )
      updateCachedProducts((cachedProducts) =>
        cachedProducts.map((item) => (item.id === updated.id ? updated : item)),
      )
      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (freeError) {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? product : item)),
      )
      setError(getErrorMessage(freeError, 'No se pudo liberar la venta del producto.'))
    } finally {
      setFreeingProducts((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
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
      updateCachedProducts((cachedProducts) =>
        cachedProducts.map((product) => (product.id === updated.id ? updated : product)),
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

  const openReport = async (date = reportDate, bazarID = activeBazarID) => {
    setShowReport(true)
    setReportDate(date)
    setReportLoading(true)
    setError(null)
    try {
      const params = {
        ...(bazarID ? { bazar_id: bazarID } : {}),
        ...(date ? { date } : {}),
      }
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

  const openDailyCut = async () => {
    if (!activeBazarID) return
    setShowCloseBazar(true)
    setReportLoading(true)
    setError(null)
    try {
      const [reportResponse, cutsResponse] = await Promise.all([
        apiClient.get<BazarReport>('/bazar/reports/daily', {
          params: { bazar_id: activeBazarID },
        }),
        apiClient.get<{ cuts: DailyCut[] }>(
          `/bazar/bazaars/${activeBazarID}/daily-cuts`,
        ),
      ])
      setReport(reportResponse)
      setDailyCuts(cutsResponse.cuts || [])
    } catch (reportError) {
      setError(getErrorMessage(reportError, 'No se pudo preparar el corte de caja.'))
      setShowCloseBazar(false)
    } finally {
      setReportLoading(false)
    }
  }

  const closeDailyCut = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeBazar) return
    if (offlineQueueCount + offlineProductCount > 0) {
      setError('Envía los productos y ventas pendientes antes de registrar el corte.')
      return
    }
    const form = new FormData(event.currentTarget)
    setClosingBazar(true)
    setError(null)
    try {
      const response = await apiClient.post<{ cut: DailyCut; report: BazarReport }>(
        `/bazar/bazaars/${activeBazar.id}/daily-cuts`,
        {
          date: String(form.get('date') || localDateKey()),
          opening_cash: Number(form.get('opening_cash') || 0),
          closing_cash: Number(form.get('closing_cash') || 0),
          notes: String(form.get('notes') || ''),
        },
      )
      setReport(response.report)
      setDailyCuts((current) => [
        response.cut,
        ...current.filter((cut) => cut.id !== response.cut.id),
      ])
      setShowCloseBazar(false)
      setShowReport(true)
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'No se pudo registrar el corte del día.'))
    } finally {
      setClosingBazar(false)
    }
  }

  const openFinalizeBazar = async () => {
    if (!activeBazarID) return
    setReportLoading(true)
    setError(null)
    try {
      const [reportResponse, cutsResponse] = await Promise.all([
        apiClient.get<BazarReport>(`/bazar/bazaars/${activeBazarID}/report`),
        apiClient.get<{ cuts: DailyCut[] }>(
          `/bazar/bazaars/${activeBazarID}/daily-cuts`,
        ),
      ])
      setReport(reportResponse)
      setDailyCuts(cutsResponse.cuts || [])
      setShowFinalizeBazar(true)
    } catch (reportError) {
      setError(getErrorMessage(reportError, 'No se pudo preparar el cierre final.'))
    } finally {
      setReportLoading(false)
    }
  }

  const finalizeBazar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeBazar) return
    if (offlineQueueCount + offlineProductCount > 0) {
      setError('Envía los productos y ventas pendientes antes de finalizar el bazar.')
      return
    }
    const todayCut = dailyCuts.find((cut) => cut.business_date === localDateKey())
    const closingCut = todayCut || (stats.operations === 0 ? dailyCuts[0] : undefined)
    if (!closingCut) {
      setError(
        stats.operations > 0
          ? 'Primero registra el corte del día de hoy.'
          : 'Registra al menos un corte antes de finalizar el bazar.',
      )
      return
    }
    const form = new FormData(event.currentTarget)
    setClosingBazar(true)
    setError(null)
    try {
      const response = await apiClient.post<{ bazar: Bazar; report: BazarReport }>(
        `/bazar/bazaars/${activeBazar.id}/close`,
        {
          closing_cash: closingCut.closing_cash,
          notes: String(form.get('notes') || ''),
        },
      )
      updateCachedBazaars((cachedBazaars) =>
        cachedBazaars.map((item) =>
          item.id === response.bazar.id ? response.bazar : item,
        ),
      )
      setBazaars((current) =>
        current.map((item) => (item.id === response.bazar.id ? response.bazar : item)),
      )
      setReport(response.report)
      setShowFinalizeBazar(false)
      setActiveBazarID('')
      localStorage.removeItem('dofer-active-bazar-id')
      setShowReport(true)
    } catch (closeError) {
      setError(getErrorMessage(closeError, 'No se pudo finalizar el bazar.'))
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
    <div
      className={
        cashMode
          ? 'cash-mode fixed inset-0 z-[60] space-y-5 overflow-y-auto bg-background px-4 pb-24 pt-[env(safe-area-inset-top)] md:px-8'
          : 'mx-auto max-w-7xl space-y-5 pb-24'
      }
    >
      <section className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <label
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${
                  viewingToday
                    ? 'border-transparent hover:border-input'
                    : 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                }`}
                title="Elegir el día que quieres ver"
              >
                <CalendarDays className="h-4 w-4" />
                <span>{dateFormatter.format(new Date(`${viewDate}T12:00:00`))}</span>
                <input
                  type="date"
                  value={viewDate}
                  max={localDateKey()}
                  onChange={(event) => setViewDate(event.target.value || localDateKey())}
                  className="w-5 cursor-pointer bg-transparent text-transparent outline-none"
                  aria-label="Día que se muestra"
                />
              </label>
              {!viewingToday && (
                <button
                  type="button"
                  onClick={() => setViewDate(localDateKey())}
                  className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                >
                  Volver a hoy
                </button>
              )}
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

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
            <label className="relative min-w-0 sm:min-w-64">
              <span className="sr-only">Bazar activo</span>
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={activeBazarID}
                onChange={(event) => {
                  const bazarID = event.target.value
                  setActiveBazarID(bazarID)
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

            {!cashMode && (
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
            )}

            {!cashMode && (
              <button
                type="button"
                onClick={() => void openReport(localDateKey())}
                disabled={reportLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {reportLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Reporte
              </button>
            )}

            {!cashMode && activeBazar && canSell && (
              <button
                type="button"
                onClick={() => void openDailyCut()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
              >
                <WalletCards className="h-4 w-4" />
                Corte del día
              </button>
            )}

            {canSell && (
              <button
                type="button"
                onClick={() => openPos()}
                disabled={!activeBazar}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                title="Nueva venta (F2)"
              >
                <ReceiptText className="h-4 w-4" />
                Nueva venta
              </button>
            )}

            {canSell && sales.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const lastSale = sales.find((sale) => sale.status === 'completed')
                  if (lastSale) setRepeatSale(lastSale)
                  else setError('Todavía no hay una venta para repetir.')
                }}
                disabled={!activeBazar}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
                title="Repetir la última venta"
              >
                <Repeat2 className="h-4 w-4" />
                Repetir
              </button>
            )}

            {canSell && activeBazar && (
              <button
                type="button"
                onClick={() => void toggleCashMode()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                title={cashMode ? 'Salir del modo caja' : 'Usar modo caja'}
              >
                {cashMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {cashMode ? 'Salir de caja' : 'Modo caja'}
              </button>
            )}

            {!cashMode && activeBazar && canSell && (
              <button
                type="button"
                onClick={() => void openFinalizeBazar()}
                disabled={reportLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-background px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <Store className="h-4 w-4" />
                Finalizar
              </button>
            )}

            {!cashMode && canSell && (
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

      {offlineQueueCount + offlineProductCount > 0 && (
        <div className="flex flex-col gap-3 border border-cyan-300 bg-cyan-50 p-3 text-sm text-cyan-950 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
          <button
            type="button"
            onClick={() => setShowOfflineQueue(true)}
            className="inline-flex items-center gap-2 text-left"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              {offlineProductCount > 0 && `${offlineProductCount} ${offlineProductCount === 1 ? 'producto' : 'productos'}, `}
              {offlineQueueCount} {offlineQueueCount === 1 ? 'venta guardada' : 'ventas guardadas'} en este dispositivo.
              {offlineErrorCount > 0 && ` ${offlineErrorCount} con error.`}
            </span>
          </button>
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
        <Metric
          label={viewingToday ? 'Vendido hoy' : 'Vendido ese día'}
          value={moneyFormatter.format(stats.total)}
          emphasized
        />
        <Metric label="Productos" value={String(stats.products_sold)} />
        <Metric label="Operaciones" value={String(stats.operations)} />
        <Metric label="Ticket promedio" value={moneyFormatter.format(stats.average_ticket)} />
        <Metric
          label="Última venta"
          value={stats.last_sale_at ? timeFormatter.format(new Date(stats.last_sale_at)) : 'Sin ventas'}
          className="col-span-2 md:col-span-1"
        />
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
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
                {visibleProductGroups.length === visibleProducts.length
                  ? `${visibleProducts.length} ${visibleProducts.length === 1 ? 'producto' : 'productos'}`
                  : `${visibleProductGroups.length} ${
                      visibleProductGroups.length === 1 ? 'modelo' : 'modelos'
                    } · ${
                      visibleVariantCount
                    } ${visibleVariantCount === 1 ? 'variante' : 'variantes'}`}
              </span>
              {canSell && (
                <button
                  type="button"
                  onClick={() => {
                    setVariantSeed(null)
                    setShowNewProduct(true)
                  }}
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
            <div
              className={
                cashMode
                  ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'
                  : 'grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]'
              }
            >
              {visibleProductGroups.map((group) => {
                const selectedProduct =
                  group.variants.find(
                    (product) => product.id === selectedVariants[group.id],
                  ) ||
                  group.variants.find((product) => favoriteProducts.has(product.id)) ||
                  group.variants[0]
                return (
                  <ProductCard
                    key={group.id}
                    group={group}
                    product={selectedProduct}
                    disabled={!canSell || !activeBazar || !selectedProduct.active}
                    canEdit={canSell}
                    favorite={favoriteProducts.has(selectedProduct.id)}
                    freeing={freeingProducts.has(selectedProduct.id)}
                    cashMode={cashMode}
                    onSelect={(product) => selectVariant(group.id, product.id)}
                    onSell={() => {
                      selectVariant(group.id, selectedProduct.id)
                      registerSale(selectedProduct, 1)
                    }}
                    onMultiple={() => {
                      selectVariant(group.id, selectedProduct.id)
                      setQuantityProduct(selectedProduct)
                      setQuantity(Math.min(2, productSaleLimit(selectedProduct)))
                    }}
                    onCart={() => {
                      selectVariant(group.id, selectedProduct.id)
                      addToCart(selectedProduct)
                    }}
                    onEdit={() => leaveCashModeForProduct(selectedProduct, 'edit')}
                    onAdjust={() => leaveCashModeForProduct(selectedProduct, 'stock')}
                    onAddVariant={() => {
                      setVariantSeed(selectedProduct)
                      setShowNewProduct(true)
                    }}
                    onFavorite={() => toggleFavoriteProduct(selectedProduct.id)}
                    onFreeSale={() => void enableFreeSale(selectedProduct)}
                  />
                )
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-semibold">Ventas recientes</h2>
              <p className="text-sm text-muted-foreground">
                {viewingToday
                  ? 'Actividad de hoy'
                  : `Actividad del ${dateFormatter.format(new Date(`${viewDate}T12:00:00`))}`}
              </p>
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
          onQuantityChange={setQuantity}
          onPaymentChange={setPaymentMethod}
          onClose={() => setQuantityProduct(null)}
          onConfirm={() => void registerSale(quantityProduct, quantity)}
        />
      )}

      {showQuickSale && activeBazar && canSell && (
        <QuickSaleDialog
          key={posSessionKey}
          bazarName={activeBazar.name}
          products={quickSaleProducts}
          initialItems={posInitialItems}
          favoriteProducts={favoriteProducts}
          saleCounts={saleCounts}
          defaultSaleDate={viewDate}
          combos={combos}
          heldSales={heldSales}
          defaultPaymentMethod={paymentMethod}
          onClose={() => setShowQuickSale(false)}
          onCreateProduct={createPosProduct}
          onFavorite={toggleFavoriteProduct}
          onSaveCombo={saveCombo}
          onDeleteCombo={deleteCombo}
          onHoldSale={holdSale}
          onDeleteHeldSale={deleteHeldSale}
          onSubmit={submitPosSale}
        />
      )}

      {repeatSale && (
        <RepeatSaleDialog
          sale={repeatSale}
          products={products}
          onClose={() => setRepeatSale(null)}
          onConfirm={() => confirmRepeatSale(repeatSale)}
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
          variantSeed={variantSeed}
          creating={creatingProduct}
          onClose={() => {
            setShowNewProduct(false)
            setVariantSeed(null)
          }}
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
          offlineQueueCount={offlineQueueCount + offlineProductCount}
          previousCut={dailyCuts[0] || null}
          closing={closingBazar}
          onClose={() => setShowCloseBazar(false)}
          onSubmit={closeDailyCut}
        />
      )}

      {showFinalizeBazar && activeBazar && (
        <FinalizeBazarDialog
          bazar={activeBazar}
          cuts={dailyCuts}
          report={report}
          todayOperations={stats.operations}
          offlineQueueCount={offlineQueueCount + offlineProductCount}
          closing={closingBazar}
          onClose={() => setShowFinalizeBazar(false)}
          onSubmit={finalizeBazar}
        />
      )}

      {showOfflineQueue && (
        <OfflineQueueDialog
          products={getOfflineProductQueue()}
          sales={readOfflineSales()}
          syncing={flushingOffline}
          onClose={() => setShowOfflineQueue(false)}
          onRetry={() => void flushOfflineSales()}
          onCorrectProduct={(product) => {
            setShowOfflineQueue(false)
            setEditingProduct(product)
          }}
          onUndoSale={(sale) => void undoSale(sale)}
        />
      )}

      {showReport && (
        <ReportDialog
          report={report}
          movements={movements}
          auditLogs={auditLogs}
          loading={reportLoading}
          date={reportDate}
          onDateChange={(date) => void openReport(date)}
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

      {confirmation && !showQuickSale && (
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
