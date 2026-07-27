import {
  readOfflineProducts,
} from './pos-storage'
import {
  productTracksStock,
} from './products'
import type {
  Bazar,
  BazarCache,
  BazarProduct,
  DailyStats,
  OfflineProductEntry,
  OfflineSaleEntry,
  Sale,
} from './types'

export const OFFLINE_SALES_KEY = 'dofer-bazar-offline-sales'

export const BAZAR_CACHE_KEY = 'dofer-bazar-cache'

export function readOfflineSales(): OfflineSaleEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function writeOfflineSales(entries: OfflineSaleEntry[]) {
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

export function getOfflineProductQueue() {
  return readOfflineProducts<OfflineProductEntry>()
}

export function mergeOfflineProducts(products: BazarProduct[]) {
  const queuedProducts = getOfflineProductQueue().map((entry) => entry.product)
  const queuedIDs = new Set(queuedProducts.map((product) => product.id))
  return [
    ...queuedProducts,
    ...products.filter((product) => !queuedIDs.has(product.id)),
  ]
}

export function countOfflineErrors() {
  return (
    readOfflineSales().filter((entry) => entry.last_error).length +
    getOfflineProductQueue().filter((entry) => entry.last_error).length
  )
}

// Suma a la jornada en pantalla las ventas que aun no llegan al servidor.
// Solo entran las de ese mismo día: una venta capturada para otra fecha se
// queda fuera del resumen de hoy aunque siga en la cola.
export function mergeActivityWithOffline(
  baseStats: DailyStats,
  serverSales: Sale[],
  bazarID: string,
  dateKey: string,
) {
  const queuedSales = readOfflineSales()
    .filter(
      (entry) =>
        entry.payload.bazar_id === bazarID &&
        entry.sale.sold_at.slice(0, 10) === dateKey,
    )
    .map((entry) => entry.sale)
  const queuedTotal = queuedSales.reduce((total, sale) => total + sale.total, 0)
  const queuedUnits = queuedSales.reduce(
    (total, sale) =>
      total + sale.items.reduce((sum, item) => sum + item.quantity, 0),
    0,
  )
  const operations = baseStats.operations + queuedSales.length
  return {
    stats: {
      ...baseStats,
      total: baseStats.total + queuedTotal,
      products_sold: baseStats.products_sold + queuedUnits,
      operations,
      pending_sync: baseStats.pending_sync + queuedSales.length,
      average_ticket: operations > 0 ? (baseStats.total + queuedTotal) / operations : 0,
      last_sale_at: queuedSales[0]?.sold_at || baseStats.last_sale_at,
    },
    sales: [
      ...queuedSales,
      ...serverSales.filter(
        (sale) =>
          !queuedSales.some(
            (queued) => queued.client_request_id === sale.client_request_id,
          ),
      ),
    ].slice(0, 12),
  }
}

export function readBazarCache(): BazarCache | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(BAZAR_CACHE_KEY) || 'null') as BazarCache | null
  } catch {
    return null
  }
}

export function writeBazarCache(cache: BazarCache) {
  try {
    // Las fotos en data URL no se guardan aquí: llenaban la cuota de
    // localStorage con unos pocos productos y tumbaban toda la caché, que es
    // justo lo que permite abrir el punto de venta al instante. Se vuelven a
    // pedir por su endpoint, donde el navegador sí las conserva.
    const products = cache.products.map((product) =>
      product.image_url?.startsWith('data:')
        ? { ...product, image_url: undefined }
        : product,
    )
    localStorage.setItem(BAZAR_CACHE_KEY, JSON.stringify({ ...cache, products }))
  } catch {
    // La cola de ventas tiene prioridad sobre la caché del catálogo.
  }
}

export function updateCachedProducts(
  update: (products: BazarProduct[]) => BazarProduct[],
) {
  const cached = readBazarCache()
  if (!cached) return
  writeBazarCache({
    ...cached,
    products: update(cached.products),
    savedAt: new Date().toISOString(),
  })
}

export function updateCachedBazaars(update: (bazaars: Bazar[]) => Bazar[]) {
  const cached = readBazarCache()
  if (!cached) return
  writeBazarCache({
    ...cached,
    bazaars: update(cached.bazaars),
    savedAt: new Date().toISOString(),
  })
}

export function applyOfflineStock(products: BazarProduct[]) {
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

export function isNetworkError(error: unknown) {
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
