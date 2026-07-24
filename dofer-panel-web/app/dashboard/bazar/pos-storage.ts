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
