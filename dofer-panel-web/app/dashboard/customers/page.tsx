'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import Link from 'next/link'

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  total_orders: number
  total_spent: number
  average_order_value: number
  customer_tier: string
  discount_percentage: number
  last_order_date?: string
  status: string
  tags: string[]
  created_at: string
}

interface CustomerStats {
  total_customers: number
  active_customers: number
  vip_customers: number
  avg_lifetime_value: number
  total_revenue: number
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    tax_id: '',
    accepts_marketing: true
  })
  const { addToast } = useToast()

  useEffect(() => {
    loadCustomers()
    loadStats()
  }, [filterTier])

  const loadCustomers = async () => {
    try {
      const params = new URLSearchParams()
      if (filterTier) params.append('tier', filterTier)
      
      const data = await apiClient.get(`/customers?${params.toString()}`)
      setCustomers((data as any).customers || [])
    } catch (error) {
      addToast({
        title: 'Error al cargar clientes',
        description: 'No se pudieron cargar los clientes',
        variant: 'error'
      })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await apiClient.get('/customers/stats')
      setStats(data as CustomerStats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) {
      loadCustomers()
      return
    }

    try {
      const data = await apiClient.get(`/customers/search?q=${encodeURIComponent(searchTerm)}`)
      setCustomers((data as any).customers || [])
    } catch (error) {
      addToast({
        title: 'Error en la búsqueda',
        description: 'No se pudo realizar la búsqueda',
        variant: 'error'
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await apiClient.post('/customers', formData)
      addToast({
        title: 'Cliente creado exitosamente',
        description: `${formData.name} ha sido agregado`,
        variant: 'success'
      })
      setShowForm(false)
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        tax_id: '',
        accepts_marketing: true
      })
      loadCustomers()
      loadStats()
    } catch (error) {
      addToast({
        title: 'Error al crear cliente',
        description: 'No se pudo crear el cliente',
        variant: 'error'
      })
      console.error(error)
    }
  }

  const getTierBadge = (tier: string) => {
    const styles = {
      vip: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/50',
      frequent: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/50',
      regular: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/50'
    }
    const icons = {
      vip: '👑',
      frequent: '⭐',
      regular: '👤'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs border ${styles[tier as keyof typeof styles]} flex items-center gap-1`}>
        <span>{icons[tier as keyof typeof icons]}</span>
        <span>{tier.toUpperCase()}</span>
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? <span className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/50">●  Activo</span>
      : <span className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/50">● Inactivo</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span>👥</span>
              <span className="text-sm">Total Clientes</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_customers}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span>✅</span>
              <span className="text-sm">Activos</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active_customers}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span>👑</span>
              <span className="text-sm">VIP</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.vip_customers}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span>💰</span>
              <span className="text-sm">Valor Promedio</span>
            </div>
            <p className="text-2xl font-bold">${stats.avg_lifetime_value.toFixed(2)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span>📊</span>
              <span className="text-sm">Ingresos Totales</span>
            </div>
            <p className="text-2xl font-bold text-primary">${stats.total_revenue.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Barra de acciones */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 flex gap-4">
          {/* Búsqueda */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-background"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                🔍
              </button>
            </div>
          </form>

          {/* Filtro por tier */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background"
          >
            <option value="">Todos los tiers</option>
            <option value="vip">VIP</option>
            <option value="frequent">Frecuentes</option>
            <option value="regular">Regulares</option>
          </select>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 shadow-sm"
        >
          <span>➕</span>
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-2xl font-bold">Nuevo Cliente</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Empresa</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RFC / Tax ID</label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="marketing"
                    checked={formData.accepts_marketing}
                    onChange={(e) => setFormData({...formData, accepts_marketing: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="marketing" className="text-sm">Acepta marketing</label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de clientes */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Contacto</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tier</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Órdenes</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Gastado</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Descuento</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      {customer.company && (
                        <p className="text-sm text-muted-foreground">{customer.company}</p>
                      )}
                      {customer.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {customer.tags.map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-accent rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p>{customer.email}</p>
                      {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{getTierBadge(customer.customer_tier)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{customer.total_orders}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-primary">
                      ${customer.total_spent.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {customer.discount_percentage > 0 ? (
                      <span className="px-2 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded text-sm font-medium">
                        {customer.discount_percentage}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(customer.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors text-sm"
                      >
                        Ver Detalles
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se encontraron clientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
