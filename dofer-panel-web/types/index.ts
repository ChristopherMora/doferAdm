export interface Order {
  id: string
  public_id: string
  order_number: string
  platform: 'tiktok' | 'shopify' | 'local' | 'other' | 'affiliate'
  status: 'new' | 'printing' | 'post' | 'packed' | 'ready' | 'delivered' | 'cancelled'
  priority: 'urgent' | 'normal' | 'low'
  customer_name: string
  customer_email?: string
  customer_phone?: string
  product_name: string
  product_image?: string
  print_file?: string
  print_file_name?: string
  quantity: number
  notes?: string
  internal_notes?: string
  assigned_to?: string
  affiliate_id?: string
  created_at: string
  updated_at: string
  completed_at?: string
  delivery_deadline?: string
  // Payment fields
  amount: number
  amount_paid: number
  balance: number
  // Timer fields
  estimated_time_minutes?: number
  actual_time_minutes?: number
  timer_started_at?: string
  timer_paused_at?: string
  is_timer_running?: boolean
  timer_total_paused_minutes?: number
  // Items
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  description?: string
  quantity: number
  unit_price: number
  total: number
  is_completed: boolean
  completed_at?: string
  created_at: string
}

export interface OrderPayment {
  id: string
  order_id: string
  amount: number
  payment_method?: string
  payment_date: string
  notes?: string
  created_by?: string
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description?: string
  stl_file_path?: string
  estimated_print_time_minutes?: number
  material?: string
  color?: string
  is_active: boolean
  image_url?: string
  suggested_price?: number
  affiliate_visible?: boolean
  affiliate_min_price?: number
  affiliate_commission_type?: 'percentage' | 'fixed'
  affiliate_commission_value?: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'operator' | 'viewer' | 'affiliate'
  created_at: string
}

export interface Affiliate {
  id: string
  organization_id: string
  user_id: string
  referral_code: string
  display_name: string
  email: string
  phone?: string
  commission_type: 'percentage' | 'fixed'
  commission_value: number
  max_pending_requests: number
  allow_urgent_orders: boolean
  status: 'active' | 'suspended'
  notes?: string
  created_at: string
  updated_at: string
}

export interface AffiliateOrderRequest {
  id: string
  organization_id: string
  affiliate_id: string
  product_id?: string
  product_name: string
  quantity: number
  suggested_price_snapshot?: number
  min_price_snapshot?: number
  final_price: number
  priority: 'urgent' | 'normal' | 'low'
  reference_images?: string[]
  customer_name: string
  customer_email?: string
  customer_phone?: string
  customer_notes?: string
  status: 'pending' | 'needs_changes' | 'approved' | 'rejected' | 'cancelled'
  requested_changes?: string
  rejection_reason?: string
  reviewed_by?: string
  reviewed_at?: string
  cancelled_reason?: string
  cancelled_by?: string
  cancelled_at?: string
  order_id?: string
  order_status?: string
  commission_type_snapshot?: 'percentage' | 'fixed'
  commission_value_snapshot?: number
  created_at: string
  updated_at: string
}

export interface AffiliateOrderRequestEvent {
  id: string
  organization_id: string
  affiliate_order_request_id: string
  actor_user_id?: string
  actor_role: string
  event_type: string
  message?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface AffiliateOrderRequestComment {
  id: string
  organization_id: string
  affiliate_order_request_id: string
  author_user_id?: string
  author_role: string
  message: string
  internal_only: boolean
  created_at: string
}

export interface AffiliateOrderRequestDetail {
  request: AffiliateOrderRequest
  events: AffiliateOrderRequestEvent[]
  comments: AffiliateOrderRequestComment[]
}

export interface AffiliateCommission {
  id: string
  organization_id: string
  affiliate_id: string
  affiliate_order_request_id: string
  order_id: string
  commission_amount: number
  status: 'pending' | 'paid'
  paid_at?: string
  paid_by?: string
  paid_batch_id?: string
  payment_method?: string
  payment_reference?: string
  payment_notes?: string
  created_at: string
  updated_at: string
}

export interface AffiliateStats {
  pending_requests: number
  approved_requests: number
  rejected_requests: number
  commission_pending: number
  commission_paid: number
  total_orders_amount: number
}

export interface Quote {
  id: string
  quote_number: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  subtotal: number
  discount: number
  tax: number
  total: number
  amount_paid: number
  balance: number
  notes?: string
  valid_until: string
  created_by: string
  created_at: string
  updated_at: string
  converted_to_order_id?: string
  items?: QuoteItem[]  // Array de items incluido en el detalle
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_name: string
  description?: string
  weight_grams: number
  print_time_hours: number
  material_cost: number
  labor_cost: number
  electricity_cost: number
  other_costs: number
  subtotal: number
  quantity: number
  unit_price: number
  total: number
  created_at: string
}

export interface TimerState {
  order_id: string
  estimated_time_minutes: number
  actual_time_minutes: number
  timer_started_at?: string
  timer_paused_at?: string
  is_timer_running: boolean
  timer_total_paused_minutes: number
  current_session_minutes: number
  percentage_complete: number
  estimated_time_remaining: number
}

export interface OperatorStats {
  operator_id: string
  operator_name: string
  total_orders: number
  completed_orders: number
  total_time_minutes: number
  avg_time_minutes: number
  estimated_vs_actual: number
  efficiency: 'fast' | 'average' | 'slow'
}
