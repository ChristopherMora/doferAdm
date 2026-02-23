'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { useToast } from '@/components/ToastProvider'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company: string
  tax_id: string
  address: string
  city: string
  state: string
  country: string
  postal_code: string
  tier: 'regular' | 'frequent' | 'vip'
  status: 'active' | 'inactive' | 'blocked'
  total_orders: number
  total_spent: number
  lifetime_value: number
  average_order_value: number
  discount_percentage: number
  preferred_materials: string[]
  tags: string[]
  notes: string
  last_order_date: string | null
  created_at: string
  updated_at: string
}

interface Order {
  id: string
  order_number: string
  status: string
  total_price: number
  created_at: string
  product_name?: string
  quantity?: number
}

interface Interaction {
  id: string
  interaction_type: 'email' | 'phone' | 'meeting' | 'note' | 'order' | 'quote' | string
  subject?: string | null
  description?: string | null
  created_by?: string | null
  created_at: string
}

interface Analytics {
  engagement_score: number
  engagement_status: string
  avg_days_between_orders: number
  preferred_contact_method: string
  peak_order_month: string
  retention_risk: string
}

interface CustomerAnalyticsRow {
  id: string
  engagement_status: string
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'interactions' | 'analytics'>('overview')
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Customer>>({})
  
  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: 'note',
    subject: '',
    description: '',
    priority: 'normal'
  })

  useEffect(() => {
    loadCustomerData()
  }, [customerId])

  const loadCustomerData = async () => {
    try {
      setLoading(true)
      const [customerData, analyticsData] = await Promise.all([
        apiClient.get<Customer>(`/customers/${customerId}`),
        apiClient.get<{ analytics: CustomerAnalyticsRow[] }>('/customers/analytics', { params: { limit: 500 } })
      ])
      
      setCustomer(customerData)
      setEditForm(customerData)

      const customerAnalytics = analyticsData.analytics?.find((item) => item.id === customerId)
      if (customerAnalytics) {
        const status = customerAnalytics.engagement_status || 'inactive'
        const engagementScore =
          status === 'active' ? 85 :
          status === 'dormant' ? 55 :
          status === 'at_risk' ? 35 :
          20

        setAnalytics({
          engagement_score: engagementScore,
          engagement_status: status,
          avg_days_between_orders: 0,
          preferred_contact_method: 'N/A',
          peak_order_month: 'N/A',
          retention_risk: status === 'active' ? 'low' : status === 'dormant' ? 'medium' : 'high',
        })
      } else {
        setAnalytics(null)
      }
      
      // Cargar interacciones
      const interactionsData = await apiClient.get<{ interactions: Interaction[] }>(`/customers/${customerId}/interactions`)
      setInteractions(interactionsData.interactions || [])
      
    } catch (error) {
      console.error('Error loading customer:', error)
      showToast('Error al cargar datos del cliente', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCustomer = async () => {
    try {
      await apiClient.put(`/customers/${customerId}`, editForm)
      showToast('Cliente actualizado exitosamente', 'success')
      setIsEditMode(false)
      loadCustomerData()
    } catch (error) {
      console.error('Error updating customer:', error)
      showToast('Error al actualizar cliente', 'error')
    }
  }

  const handleAddInteraction = async () => {
    try {
      await apiClient.post(`/customers/${customerId}/interactions`, newInteraction)
      showToast('Interacción registrada', 'success')
      setShowInteractionModal(false)
      setNewInteraction({ interaction_type: 'note', subject: '', description: '', priority: 'normal' })
      loadCustomerData()
    } catch (error) {
      console.error('Error adding interaction:', error)
      showToast('Error al registrar interacción', 'error')
    }
  }

  const getTierBadge = (tier: string) => {
    const badges = {
      vip: { icon: '👑', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20', label: 'VIP' },
      frequent: { icon: '⭐', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', label: 'Frecuente' },
      regular: { icon: '👤', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20', label: 'Regular' }
    }
    const badge = badges[tier as keyof typeof badges] || badges.regular
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <span>{badge.icon}</span>
        {badge.label}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20', label: 'Activo' },
      inactive: { color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20', label: 'Inactivo' },
      blocked: { color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', label: 'Bloqueado' }
    }
    const badge = badges[status as keyof typeof badges] || badges.inactive
    return <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>{badge.label}</span>
  }

  const getInteractionIcon = (type: string) => {
    const icons = {
      email: '📧',
      phone: '📞',
      meeting: '🤝',
      note: '📝',
      order: '📦',
      quote: '💼'
    }
    return icons[type as keyof typeof icons] || '📝'
  }

  if (loading || !customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/customers')}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Volver a clientes"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
          <div className="flex gap-2">
            {getTierBadge(customer.tier)}
            {getStatusBadge(customer.status)}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditMode ? (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              ✏️ Editar
            </button>
          ) : (
            <>
              <button
                onClick={handleUpdateCustomer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                💾 Guardar
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false)
                  setEditForm(customer)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                ✖️ Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {(['overview', 'orders', 'interactions', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' && '📋 General'}
              {tab === 'orders' && '📦 Órdenes'}
              {tab === 'interactions' && '💬 Interacciones'}
              {tab === 'analytics' && '📊 Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información Personal */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Información Personal</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Nombre</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.name}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                {isEditMode ? (
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.email}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Teléfono</label>
                {isEditMode ? (
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.phone || 'No registrado'}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Empresa</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editForm.company || ''}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.company || 'No registrado'}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">RFC</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editForm.tax_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.tax_id || 'No registrado'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Estadísticas</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary/5 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Órdenes</p>
                <p className="text-2xl font-bold">{customer.total_orders}</p>
              </div>
              
              <div className="bg-green-500/10 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Gastado</p>
                <p className="text-2xl font-bold">${customer.total_spent.toLocaleString()}</p>
              </div>
              
              <div className="bg-blue-500/10 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Valor Promedio</p>
                <p className="text-2xl font-bold">${customer.average_order_value.toLocaleString()}</p>
              </div>
              
              <div className="bg-yellow-500/10 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Descuento</p>
                <p className="text-2xl font-bold">{customer.discount_percentage}%</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Última Orden</p>
              <p className="font-medium">
                {customer.last_order_date 
                  ? new Date(customer.last_order_date).toLocaleDateString('es-MX')
                  : 'Sin órdenes'}
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Cliente desde</p>
              <p className="font-medium">
                {new Date(customer.created_at).toLocaleDateString('es-MX')}
              </p>
            </div>
          </div>

          {/* Dirección */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Dirección</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Dirección</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                ) : (
                  <p className="font-medium">{customer.address || 'No registrado'}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Ciudad</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    />
                  ) : (
                    <p className="font-medium">{customer.city || 'No registrado'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Estado</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editForm.state || ''}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    />
                  ) : (
                    <p className="font-medium">{customer.state || 'No registrado'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">País</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editForm.country || ''}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    />
                  ) : (
                    <p className="font-medium">{customer.country || 'No registrado'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">C.P.</label>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editForm.postal_code || ''}
                      onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    />
                  ) : (
                    <p className="font-medium">{customer.postal_code || 'No registrado'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Notas Internas</h2>
            
            {isEditMode ? (
              <textarea
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg resize-none"
                placeholder="Agregar notas internas sobre el cliente..."
              />
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap">
                {customer.notes || 'Sin notas'}
              </p>
            )}

            {customer.tags && customer.tags.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Etiquetas</p>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Historial de Interacciones</h2>
            <button
              onClick={() => setShowInteractionModal(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              ➕ Nueva Interacción
            </button>
          </div>

          <div className="space-y-3">
            {interactions.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-12 text-center">
                <p className="text-muted-foreground">Sin interacciones registradas</p>
              </div>
            ) : (
              interactions.map((interaction) => (
                <div key={interaction.id} className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{getInteractionIcon(interaction.interaction_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{interaction.subject || 'Sin asunto'}</h3>
                        <span className="text-sm text-muted-foreground">
                          {new Date(interaction.created_at).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">{interaction.description || 'Sin descripción'}</p>
                      <p className="text-xs text-muted-foreground mt-2">Por: {interaction.created_by || 'sistema'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm text-muted-foreground mb-2">Score de Engagement</h3>
            <p className="text-3xl font-bold">{analytics.engagement_score}/100</p>
            <p className="text-sm mt-2 text-muted-foreground">Estado: {analytics.engagement_status}</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm text-muted-foreground mb-2">Promedio entre Órdenes</h3>
            <p className="text-3xl font-bold">{analytics.avg_days_between_orders}</p>
            <p className="text-sm mt-2 text-muted-foreground">días</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm text-muted-foreground mb-2">Riesgo de Retención</h3>
            <p className="text-3xl font-bold capitalize">{analytics.retention_risk}</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm text-muted-foreground mb-2">Método Preferido</h3>
            <p className="text-xl font-semibold capitalize">{analytics.preferred_contact_method || 'N/A'}</p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-sm text-muted-foreground mb-2">Mes de Mayor Actividad</h3>
            <p className="text-xl font-semibold">{analytics.peak_order_month || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Modal Nueva Interacción */}
      {showInteractionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-semibold">Nueva Interacción</h2>
            
            <div>
              <label className="text-sm text-muted-foreground">Tipo</label>
              <select
                value={newInteraction.interaction_type}
                onChange={(e) => setNewInteraction({ ...newInteraction, interaction_type: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
              >
                <option value="note">📝 Nota</option>
                <option value="email">📧 Email</option>
                <option value="phone">📞 Llamada</option>
                <option value="meeting">🤝 Reunión</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Asunto</label>
              <input
                type="text"
                value={newInteraction.subject}
                onChange={(e) => setNewInteraction({ ...newInteraction, subject: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                placeholder="Resumen de la interacción"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Descripción</label>
              <textarea
                value={newInteraction.description}
                onChange={(e) => setNewInteraction({ ...newInteraction, description: e.target.value })}
                rows={4}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg resize-none"
                placeholder="Detalles de la interacción..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleAddInteraction}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowInteractionModal(false)
                  setNewInteraction({ interaction_type: 'note', subject: '', description: '', priority: 'normal' })
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:opacity-90"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
