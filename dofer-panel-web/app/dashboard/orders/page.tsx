'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { Plus, FileDown, FileSpreadsheet, Search, Filter, Package } from 'lucide-react'
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
}

export default function OrdersPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ordersPerPage = 50

  useEffect(() => {
    loadOrders()
  }, [filterStatus, currentPage])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const offset = (currentPage - 1) * ordersPerPage
      const params: any = {
        limit: ordersPerPage,
        offset: offset,
      }
      
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      
      const response = await apiClient.get<{ orders: Order[], total: number }>('/orders', { params })
      setOrders(response.orders || [])
      setTotalOrders(response.total || 0)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

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
    { value: 'all', label: 'Todos' },
    { value: 'new', label: 'Nuevas' },
    { value: 'printing', label: 'En Impresión' },
    { value: 'post', label: 'Post-proceso' },
    { value: 'packed', label: 'Empacadas' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ]

  const getFilteredOrders = () => {
    return orders.filter(order => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.product_name.toLowerCase().includes(query)
      )
    })
  }

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
    } catch (error) {
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
    } catch (error) {
      addToast({
        title: 'Error al generar PDF',
        description: 'No se pudo crear el archivo',
        variant: 'error'
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header operativo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Órdenes</h1>
          <p className="text-base text-muted-foreground mt-2 font-medium">
            <span className="text-2xl font-bold text-foreground">{totalOrders}</span> {totalOrders === 1 ? 'orden registrada' : 'órdenes registradas'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="h-9">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" className="h-9">
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)} size="default" className="h-10 px-6 text-base font-semibold elevated-md hover:elevated-lg transition-all">
            <Plus className="h-5 w-5 mr-2" />
            Nueva Orden
          </Button>
        </div>
      </div>

      {/* Filtros operativos */}
      <Card className="elevated-md">
        <CardContent className="pt-6 pb-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por # orden, cliente o producto..."
                  className="w-full pl-12 pr-4 py-3 text-base bg-background border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <Filter className="h-5 w-5 text-muted-foreground" />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 bg-background border-2 rounded-xl text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer hover:border-primary/50"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla operativa */}
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
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider"># Orden</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Producto</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cant.</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioridad</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Plataforma</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredOrders().length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16">
                        <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery
                            ? `No se encontraron órdenes con "${searchQuery}"`
                            : filterStatus === 'all' 
                            ? 'No hay órdenes registradas' 
                            : `No hay órdenes "${statusOptions.find(o => o.value === filterStatus)?.label}"`
                          }
                        </p>
                      </td>
                    </tr>
                  ) : (
                    getFilteredOrders().map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors cursor-pointer group animate-fade-in" onClick={() => router.push(`/dashboard/orders/${order.id}`)}>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm">{order.order_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {order.product_image && (
                              <img 
                                src={order.product_image} 
                                alt={order.product_name}
                                className="h-8 w-8 object-cover rounded border"
                              />
                            )}
                            <span className="text-sm">{order.product_name}</span>
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
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                          {order.platform}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm hidden lg:table-cell">
                          {new Date(order.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dashboard/orders/${order.id}`)
                            }}
                          >
                            Ver →
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
