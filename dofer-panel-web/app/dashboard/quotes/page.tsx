'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Filter, AlertTriangle } from 'lucide-react'
import { Quote } from '@/types'

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [backendError, setBackendError] = useState(false)

  useEffect(() => {
    loadQuotes()
  }, [])

  const loadQuotes = async () => {
    try {
      setLoading(true)
      setBackendError(false)
      const response = await apiClient.get<{ quotes: Quote[], total: number }>('/quotes')
      setQuotes(response.quotes || [])
    } catch (error: any) {
      console.error('Error loading quotes:', error)
      if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        setBackendError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'default',
      approved: 'outline',
      rejected: 'destructive',
      expired: 'secondary',
    }
    return variants[status] || 'secondary'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      expired: 'Expirada',
    }
    return labels[status] || status
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const filteredQuotes = filterStatus === 'all' 
    ? quotes 
    : quotes.filter(q => q.status === filterStatus)

  return (
    <div className="space-y-6">
      {/* Header operativo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">{quotes.length} cotizaciones registradas</p>
        </div>
        <Button onClick={() => router.push('/dashboard/quotes/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cotización
        </Button>
      </div>

      {/* Alerta de backend */}
      {backendError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Backend no conectado</p>
              <p className="text-xs text-muted-foreground mt-0.5">No se pueden cargar las cotizaciones</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="expired">Expiradas</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla operativa */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-sm text-muted-foreground mt-3">Cargando cotizaciones...</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="p-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No hay cotizaciones {filterStatus !== 'all' && `"${getStatusLabel(filterStatus)}"`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider"># Cotización</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Válida hasta</th>
                    <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                    <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => (
                    <tr key={quote.id} className="border-b hover:bg-accent transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">{quote.quote_number}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{quote.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{quote.customer_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold tabular-nums">{formatCurrency(quote.total)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadge(quote.status)}>{getStatusLabel(quote.status)}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm hidden md:table-cell">
                        {new Date(quote.valid_until).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm hidden lg:table-cell">
                        {new Date(quote.created_at).toLocaleDateString('es-MX', {
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
                            router.push(`/dashboard/quotes/${quote.id}`)
                          }}
                        >
                          Ver →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen */}
      {filteredQuotes.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{filteredQuotes.length}</span> cotizaciones
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
