export interface Order {
  id: string
  public_id: string
  order_number: string
  platform: 'tiktok' | 'shopify' | 'local' | 'other'
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
  created_at: string
  updated_at: string
  completed_at?: string
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
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'operator' | 'viewer'
  created_at: string
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

