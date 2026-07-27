

export interface BazarProduct {
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
  variant_group_id?: string
  variant_name?: string
  variant_color?: string
}

export interface ProductGroup {
  id: string
  name: string
  category: string
  variants: BazarProduct[]
}

export interface Bazar {
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

export interface SaleItem {
  product_id: string
  product_external_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
  stock_before: number
  stock_after: number
}

export interface Sale {
  id: string
  external_id: string
  client_request_id: string
  bazar_id: string
  bazar_name: string
  seller_name: string
  total: number
  payment_method: PaymentMethod
  cash_received?: number
  change_due?: number
  status: 'completed' | 'cancelled'
  sync_status: 'pending' | 'synced' | 'error'
  sync_error?: string
  // sold_at es el día al que pertenece la venta; created_at es cuándo se
  // capturó. Coinciden salvo en ventas registradas en días posteriores.
  sold_at: string
  created_at: string
  items: SaleItem[]
}

export interface DailyStats {
  total: number
  products_sold: number
  operations: number
  average_ticket: number
  last_sale_at?: string
  pending_sync: number
  low_stock_products: number
  out_of_stock_products: number
}

export interface SyncStatus {
  configured: boolean
  status: 'synced' | 'pending' | 'error' | 'not_configured'
  pending_sales: number
  failed_sales: number
  last_product_sync?: string
  last_sale_sync?: string
  last_error?: string
  configuration_message?: string
}

export interface PaymentSummary {
  method: PaymentMethod
  operations: number
  total: number
}

export interface ProductSummary {
  product_id: string
  external_id: string
  product_name: string
  quantity: number
  total: number
}

export interface SellerSummary {
  seller_name: string
  operations: number
  quantity: number
  total: number
}

export interface BazarReport {
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

export interface InventoryMovement {
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

export interface AuditLog {
  id: string
  actor_name: string
  action: string
  entity_type: string
  details: Record<string, unknown>
  created_at: string
}

export interface SyncConflict {
  product_id: string
  external_id: string
  product_name: string
  local_stock: number
  sheet_stock: number
  local_price: number
  sheet_price: number
}

export interface SalePayload {
  client_request_id: string
  bazar_id: string
  items: Array<{ product_id: string; quantity: number }>
  payment_method: PaymentMethod
  cash_received?: number
  sold_at?: string
}

export interface PosCheckoutInput {
  items: Array<{ product: BazarProduct; quantity: number }>
  paymentMethod: PaymentMethod
  cashReceived?: number
  saleDate?: string
  keepOpen: boolean
}

export interface OfflineSaleEntry {
  payload: SalePayload
  sale: Sale
  attempts?: number
  last_error?: string
}

export interface OfflineProductEntry {
  payload: {
    id?: string
    sku: string
    name: string
    category: string
    price: number
    stock?: number
    track_stock?: boolean
    image_url?: string
    active?: boolean
    stock_sync_policy?: string
    variant_group_id?: string
    variant_name?: string
    variant_color?: string
  }
  product: BazarProduct
  operation?: 'create' | 'update'
  attempts: number
  last_error?: string
}

export interface DailyCut {
  id: string
  bazar_id: string
  bazar_name: string
  business_date: string
  opening_cash: number
  cash_sales: number
  expected_cash: number
  closing_cash: number
  cash_difference: number
  notes?: string
  closed_by_name: string
  closed_at: string
}

export interface BazarCache {
  products: BazarProduct[]
  bazaars: Bazar[]
  currentUser: CurrentUser
  syncStatus: SyncStatus | null
  // La actividad se guarda con el día al que pertenece: sin eso, al abrir
  // el bazar en una fecha nueva se repintaba la jornada anterior.
  activity?: Record<string, { date: string; sales: Sale[]; stats: DailyStats }>
  savedAt: string
}

export interface CurrentUser {
  full_name: string
  email: string
  role: string
  organization_role?: string
}

export interface SaleResponse {
  sale: Sale
  duplicated: boolean
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'mercado_pago' | 'other'

export type StockFilter = 'all' | 'available' | 'low' | 'out' | 'inactive'
