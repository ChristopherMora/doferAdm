export interface StoredCartItem {
  product_id: string
  quantity: number
}

export interface StoredCombo {
  id: string
  name: string
  items: StoredCartItem[]
  created_at: string
}

export interface StoredHeldSale {
  id: string
  name: string
  items: StoredCartItem[]
  payment_method: string
  created_at: string
}

const FAVORITES_KEY = 'dofer-bazar-favorite-products'
const COMBOS_KEY = 'dofer-bazar-combos'
const HELD_SALES_KEY = 'dofer-bazar-held-sales'
const LAST_PAYMENT_KEY = 'dofer-bazar-last-payment-method'
const LAST_VARIANTS_KEY = 'dofer-bazar-last-variants'
const SALE_COUNTS_KEY = 'dofer-bazar-sale-counts'
export const OFFLINE_PRODUCTS_KEY = 'dofer-bazar-offline-products'

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    return parsed === null ? fallback : parsed as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readFavoriteProducts() {
  const values = readJSON<unknown>(FAVORITES_KEY, [])
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : []
}

export function writeFavoriteProducts(productIDs: string[]) {
  return writeJSON(FAVORITES_KEY, productIDs)
}

export function readCombos() {
  const values = readJSON<unknown>(COMBOS_KEY, [])
  return Array.isArray(values) ? values as StoredCombo[] : []
}

export function writeCombos(combos: StoredCombo[]) {
  return writeJSON(COMBOS_KEY, combos)
}

export function readHeldSales() {
  const values = readJSON<unknown>(HELD_SALES_KEY, [])
  return Array.isArray(values) ? values as StoredHeldSale[] : []
}

export function writeHeldSales(sales: StoredHeldSale[]) {
  return writeJSON(HELD_SALES_KEY, sales)
}

export function readLastPaymentMethod() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(LAST_PAYMENT_KEY) || ''
}

export function writeLastPaymentMethod(method: string) {
  try {
    localStorage.setItem(LAST_PAYMENT_KEY, method)
  } catch {
    // La venta no debe fallar si el navegador bloquea preferencias locales.
  }
}

export function readLastVariants() {
  const values = readJSON<unknown>(LAST_VARIANTS_KEY, {})
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {}
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  )
}

export function writeLastVariant(groupID: string, productID: string) {
  return writeJSON(LAST_VARIANTS_KEY, {
    ...readLastVariants(),
    [groupID]: productID,
  })
}

interface SaleCountsRecord {
  date: string
  counts: Record<string, number>
}

// Unidades vendidas por producto durante el día en este dispositivo. Sirve
// para poner arriba del buscador lo que más se está moviendo en el bazar.
export function readProductSaleCounts(dateKey: string): Record<string, number> {
  const stored = readJSON<Partial<SaleCountsRecord> | null>(SALE_COUNTS_KEY, null)
  if (!stored || stored.date !== dateKey || typeof stored.counts !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(stored.counts || {}).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  )
}

export function recordProductSales(
  dateKey: string,
  items: Array<{ product_id: string; quantity: number }>,
) {
  const counts = readProductSaleCounts(dateKey)
  for (const item of items) {
    counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity
  }
  writeJSON(SALE_COUNTS_KEY, { date: dateKey, counts })
  return counts
}

export function readOfflineProducts<T>() {
  const values = readJSON<unknown>(OFFLINE_PRODUCTS_KEY, [])
  return Array.isArray(values) ? values as T[] : []
}

export function writeOfflineProducts<T>(products: T[]) {
  return writeJSON(OFFLINE_PRODUCTS_KEY, products)
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
