'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image, { type ImageLoaderProps } from 'next/image'
import EmptyState from '@/components/dashboard/EmptyState'
import PageHeader from '@/components/dashboard/PageHeader'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Plus, FileDown, FileSpreadsheet, Search, Filter, Package, X, Calendar, AlertCircle } from 'lucide-react'
import CreateOrderModal from './CreateOrderModal'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  product_name: string
  product_image?: string
  quantity: number
  status: string
  priority: string
  platform: string
  created_at: string
  updated_at: string
  delivery_deadline?: string
}

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src

export default function OrdersPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [filterDateRange, setFilterDateRange] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ordersPerPage = 50

  // Atajos de teclado para página de órdenes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      // Cmd/Ctrl + N para nueva orden
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isInputField) {
        e.preventDefault()
        setIsCreateModalOpen(true)
        return
      }
      
      // F para toggle filtros
      if (e.key === 'f' && !isInputField && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowFilters(prev => !prev)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (currentPage - 1) * ordersPerPage
      const params: Record<string, string | number> = {
        limit: ordersPerPage,
        offset: offset,
      }
      
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      
      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      
      const response = await apiClient.get<{ orders: Order[], total: number }>('/orders', { params })
      setOrders(response.orders || [])
      setTotalOrders(response.total || 0)
    } catch (error) {
      console.error('Error loading orders:', error)
      addToast({
        title: 'Error al cargar órdenes',
        description: 'No se pudieron cargar las órdenes',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, currentPage, debouncedSearch, filterStatus, ordersPerPage])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const getStatusBadge = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'default',
      printing: 'secondary',
      post: 'secondary',
      packed: 'secondary',
      ready: 'default',
      delivered: 'outline',
      cancelled: 'destructive',
    }
    return variants[status] || 'outline'
  }

  const getPriorityBadge = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      urgent: 'destructive',
      normal: 'default',
      low: 'secondary',
    }
    return variants[priority] || 'secondary'
  }

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'new', label: 'Nuevas' },
    { value: 'printing', label: 'En Impresión' },
    { value: 'post', label: 'Post-proceso' },
    { value: 'packed', label: 'Empacadas' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ]

  const priorityOptions = [
    { value: 'all', label: 'Todas las prioridades' },
    { value: 'urgent', label: 'Urgente' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Baja' },
  ]

  const platformOptions = [
    { value: 'all', label: 'Todas las plataformas' },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Instagram', label: 'Instagram' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'Website', label: 'Sitio Web' },
    { value: 'Phone', label: 'Teléfono' },
    { value: 'Other', label: 'Otro' },
  ]

  const dateRangeOptions = [
    { value: 'all', label: 'Todas las fechas' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
  ]

  const getFilteredOrders = () => {
    let filtered = orders
    
    // Filtro de prioridad (client-side)
    if (filterPriority !== 'all') {
      filtered = filtered.filter(order => order.priority === filterPriority)
    }
    
    // Filtro de plataforma (client-side)
    if (filterPlatform !== 'all') {
      filtered = filtered.filter(order => order.platform === filterPlatform)
    }
    
    // Filtro de rango de fecha (client-side)
    if (filterDateRange !== 'all') {
      const now = new Date()
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at)
        const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
        
        switch (filterDateRange) {
          case 'today': return diffDays === 0
          case 'week': return diffDays <= 7
          case 'month': return diffDays <= 30
          default: return true
        }
      })
    }
    
    return filtered
  }

  const clearFilters = () => {
    setFilterStatus('all')
    setFilterPriority('all')
    setFilterPlatform('all')
    setFilterDateRange('all')
    setSearchQuery('')
  }

  const activeFiltersCount = [
    filterStatus !== 'all',
    filterPriority !== 'all',
    filterPlatform !== 'all',
    filterDateRange !== 'all',
    searchQuery !== ''
  ].filter(Boolean).length

  const exportToExcel = () => {
    try {
      const filteredOrders = getFilteredOrders()
      
      // Crear CSV (compatible con Excel)
      const headers = ['# Orden', 'Cliente', 'Email', 'Producto', 'Cantidad', 'Estado', 'Prioridad', 'Plataforma', 'Fecha']
      const rows = filteredOrders.map(order => [
        order.order_number,
        order.customer_name,
        order.customer_email || '',
        order.product_name,
        order.quantity,
        order.status,
        order.priority,
        order.platform,
        new Date(order.created_at).toLocaleDateString('es-MX')
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `ordenes_${new Date().toISOString().split('T')[0]}.csv`
      link.click()

      addToast({
        title: 'Exportado correctamente',
        description: `${filteredOrders.length} órdenes exportadas a Excel`,
        variant: 'success'
      })
    } catch {
      addToast({
        title: 'Error al exportar',
        description: 'No se pudo exportar el archivo',
        variant: 'error'
      })
    }
  }

  const exportToPDF = () => {
    try {
      const filteredOrders = getFilteredOrders()
      
      const doc = new jsPDF()
      
      // Título
      doc.setFontSize(18)
      doc.text('Reporte de Órdenes - DOFER Panel', 14, 22)
      
      // Fecha
      doc.setFontSize(10)
      doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 30)
      
      // Tabla
      autoTable(doc, {
        startY: 35,
        head: [['# Orden', 'Cliente', 'Producto', 'Cant.', 'Estado', 'Prioridad', 'Fecha']],
        body: filteredOrders.map(order => [
          order.order_number,
          order.customer_name,
          order.product_name,
          order.quantity,
          order.status,
          order.priority,
          new Date(order.created_at).toLocaleDateString('es-MX')
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 92, 246] },
      })
      
      doc.save(`ordenes_${new Date().toISOString().split('T')[0]}.pdf`)

      addToast({
        title: 'PDF generado',
        description: `${filteredOrders.length} órdenes exportadas`,
        variant: 'success'
      })
    } catch {
      addToast({
        title: 'Error al generar PDF',
        description: 'No se pudo crear el archivo',
        variant: 'error'
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ordenes"
        badge="Operaciones"
        description={`${totalOrders} ${totalOrders === 1 ? 'orden registrada' : 'ordenes registradas'} en el sistema.`}
        actions={
          <>
            <Button onClick={exportToExcel} variant="outline" size="sm" className="h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm" className="h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)} size="default" className="h-10 px-6 text-base font-semibold bg-white text-slate-900 hover:bg-slate-100">
              <Plus className="h-5 w-5 mr-2" />
              Nueva Orden
            </Button>
          </>
        }
      />

      {/* Filtros avanzados */}
      <Card className="elevated-md">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            {/* Barra de búsqueda principal */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[280px]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por # orden, cliente o producto..."
                    aria-label="Buscar órdenes"
                    className="w-full pl-12 pr-4 py-3 text-base bg-background border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
                aria-label="Mostrar filtros avanzados"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="gap-2"
                  aria-label="Limpiar todos los filtros"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>

            {/* Filtros expandibles */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Estado</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    aria-label="Filtrar por estado"
                    className="w-full px-3 py-2 bg-background border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Prioridad</label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    aria-label="Filtrar por prioridad"
                    className="w-full px-3 py-2 bg-background border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Plataforma</label>
                  <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    aria-label="Filtrar por plataforma"
                    className="w-full px-3 py-2 bg-background border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    {platformOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Fecha</label>
                  <select
                    value={filterDateRange}
                    onChange={(e) => setFilterDateRange(e.target.value)}
                    aria-label="Filtrar por rango de fecha"
                    className="w-full px-3 py-2 bg-background border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                  >
                    {dateRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vista responsive: Cards en móvil, Tabla en desktop */}
      <Card className="elevated-lg overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : getFilteredOrders().length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={searchQuery || activeFiltersCount > 0 ? 'Sin resultados con filtros' : 'No hay ordenes registradas'}
                description="Prueba limpiando filtros o creando una nueva orden."
                icon={<Package className="h-5 w-5" />}
                action={
                  activeFiltersCount > 0 ? (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="mt-2 gap-2"
                    >
                      <X className="h-4 w-4" />
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {/* Vista de Cards para móvil */}
              <div className="md:hidden divide-y">
                {getFilteredOrders().map((order) => {
                  const isOverdue = order.delivery_deadline && new Date(order.delivery_deadline) < new Date() && !['delivered', 'cancelled'].includes(order.status)
                  
                  return (
                    <div
                      key={order.id}
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                      className="p-4 hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="space-y-3">
                        {/* Header del card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                              {isOverdue && (
                                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" aria-label="Orden vencida" />
                              )}
                            </div>
                            <p className="font-medium truncate">{order.customer_name}</p>
                            {order.customer_email && (
                              <p className="text-xs text-muted-foreground truncate">{order.customer_email}</p>
                            )}
                          </div>
                          {order.product_image && (
                            <Image
                              src={order.product_image}
                              alt={order.product_name}
                              loader={passthroughImageLoader}
                              unoptimized
                              width={48}
                              height={48}
                              className="h-12 w-12 object-cover rounded border flex-shrink-0"
                            />
                          )}
                        </div>

                        {/* Producto */}
                        <div>
                          <p className="text-sm">{order.product_name}</p>
                          <p className="text-xs text-muted-foreground">Cantidad: {order.quantity}</p>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getStatusBadge(order.status)}>{order.status}</Badge>
                          <Badge variant={getPriorityBadge(order.priority)}>{order.priority}</Badge>
                          <Badge variant="outline" className="text-xs">{order.platform}</Badge>
                        </div>

                        {/* Fecha y deadline */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.created_at).toLocaleDateString('es-MX')}
                          </span>
                          {order.delivery_deadline && (
                            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                              Entrega: {new Date(order.delivery_deadline).toLocaleDateString('es-MX')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Vista de Tabla para desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider"># Orden</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Producto</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cant.</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioridad</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Plataforma</th>
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Fecha</th>
                      <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredOrders().map((order) => {
                      const isOverdue = order.delivery_deadline && new Date(order.delivery_deadline) < new Date() && !['delivered', 'cancelled'].includes(order.status)
                      
                      return (
                        <tr 
                          key={order.id} 
                          className="border-b hover:bg-muted/50 transition-colors cursor-pointer group" 
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{order.order_number}</span>
                              {isOverdue && (
                                <AlertCircle className="h-4 w-4 text-red-500" aria-label="Orden vencida" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{order.customer_name}</div>
                            {order.customer_email && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{order.customer_email}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {order.product_image && (
                                <Image
                                  src={order.product_image}
                                  alt={order.product_name}
                                  loader={passthroughImageLoader}
                                  unoptimized
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 object-cover rounded border"
                                />
                              )}
                              <span className="text-sm truncate max-w-[200px]">{order.product_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium tabular-nums">
                            {order.quantity}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadge(order.status)}>{order.status}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getPriorityBadge(order.priority)}>{order.priority}</Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {order.platform}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-sm">
                            <div>{new Date(order.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short'
                            })}</div>
                            {order.delivery_deadline && (
                              <div className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                                ⏰ {new Date(order.delivery_deadline).toLocaleDateString('es-MX', {
                                  day: '2-digit',
                                  month: 'short'
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/orders/${order.id}`)
                              }}
                              aria-label={`Ver detalles de orden ${order.order_number}`}
                            >
                              Ver →
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Paginación funcional */}
      {totalOrders > ordersPerPage && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{(currentPage - 1) * ordersPerPage + 1}</span> a{' '}
                <span className="font-medium text-foreground">{Math.min(currentPage * ordersPerPage, totalOrders)}</span> de{' '}
                <span className="font-medium text-foreground">{totalOrders}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  ← Anterior
                </Button>
                <div className="flex items-center px-3 text-muted-foreground">
                  Página {currentPage} de {Math.ceil(totalOrders / ordersPerPage)}
                </div>
                <Button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / ordersPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalOrders / ordersPerPage)}
                  variant="outline"
                  size="sm"
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadOrders}
      />
    </div>
  )
}
