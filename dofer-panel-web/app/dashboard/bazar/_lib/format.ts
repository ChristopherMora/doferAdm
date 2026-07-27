import {
  MOVEMENT_OPTIONS,
  PAYMENT_METHODS,
} from './constants'
import type {
  PaymentMethod,
  SyncStatus,
} from './types'

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: 'numeric',
  minute: '2-digit',
})

export function escapeHTML(value: string) {
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

export function syncLabel(status: SyncStatus | null) {
  if (!status) return 'Comprobando'
  if (status.status === 'synced') return 'Sincronizado'
  if (status.status === 'pending') return `${status.pending_sales} pendientes`
  if (status.status === 'error') return 'Error de sincronización'
  return 'Sheets sin configurar'
}

export function paymentLabel(method: PaymentMethod) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label || 'Otro'
}

export function movementLabel(type: string) {
  return MOVEMENT_OPTIONS.find((item) => item.value === type)?.label || type
}
