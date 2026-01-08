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
