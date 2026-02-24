'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import TableShell from '@/components/dashboard/TableShell'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Filter, AlertTriangle, Edit, Search, X } from 'lucide-react'
import { Quote } from '@/types'

type QuoteStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired'
const SAVED_QUOTE_VIEWS_KEY = 'dofer_quotes_saved_views_v1'

const QUOTE_STATUS_OPTIONS: Array<{ value: QuoteStatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'expired', label: 'Expiradas' },
]

function normalizeStatusFilter(value: string | null): QuoteStatusFilter {
  if (value === 'pending' || value === 'approved' || value === 'rejected' || value === 'expired') {
    return value
  }
  return 'all'
}

interface SavedQuoteView {
  id: string
  name: string
  status: QuoteStatusFilter
  q: string
}

export default function QuotesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<QuoteStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)
  const [backendError, setBackendError] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedQuoteView[]>([])
  const [savingView, setSavingView] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  useEffect(() => {
    if (filtersReady) return
    setFilterStatus(normalizeStatusFilter(searchParams.get('status')))
    setSearchQuery(searchParams.get('q') || '')
    setFiltersReady(true)
  }, [filtersReady, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(SAVED_QUOTE_VIEWS_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as SavedQuoteView[]
      if (Array.isArray(parsed)) setSavedViews(parsed)
    } catch {
      window.localStorage.removeItem(SAVED_QUOTE_VIEWS_KEY)
    }
  }, [])

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true)
      setBackendError(false)
      const response = await apiClient.get<{ quotes: Quote[]; total: number }>('/quotes')
      setQuotes(response.quotes || [])
    } catch (error: unknown) {
      console.error('Error loading quotes:', error)
      const message = getErrorMessage(error, '')
      if (message.includes('fetch') || message.includes('Failed to fetch')) {
        setBackendError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    void loadQuotes()
  }, [filtersReady, loadQuotes])

  useEffect(() => {
    if (!filtersReady) return

    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())

    const query = params.toString()
    const nextURL = query ? `${pathname}?${query}` : pathname
    router.replace(nextURL, { scroll: false })
  }, [filterStatus, filtersReady, pathname, router, searchQuery])

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

  const filteredQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return quotes.filter((quote) => {
      const matchesStatus = filterStatus === 'all' || quote.status === filterStatus
      const matchesSearch =
        query === '' ||
        quote.quote_number.toLowerCase().includes(query) ||
        quote.customer_name.toLowerCase().includes(query) ||
        (quote.customer_email || '').toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [filterStatus, quotes, searchQuery])

  const activeFiltersCount = [filterStatus !== 'all', searchQuery.trim() !== ''].filter(Boolean).length

  const clearFilters = () => {
    setFilterStatus('all')
    setSearchQuery('')
  }

  const persistSavedViews = (views: SavedQuoteView[]) => {
    setSavedViews(views)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SAVED_QUOTE_VIEWS_KEY, JSON.stringify(views))
    }
  }

  const handleSaveCurrentView = () => {
    const trimmedName = newViewName.trim()
    if (!trimmedName) return

    const view: SavedQuoteView = {
      id: crypto.randomUUID(),
      name: trimmedName,
      status: filterStatus,
      q: searchQuery.trim(),
    }
    persistSavedViews([view, ...savedViews].slice(0, 12))
    setSavingView(false)
    setNewViewName('')
  }

  const handleApplySavedView = (view: SavedQuoteView) => {
    setFilterStatus(view.status)
    setSearchQuery(view.q)
  }

  const handleDeleteSavedView = (viewID: string) => {
    persistSavedViews(savedViews.filter((view) => view.id !== viewID))
  }

  if (loading) {
    return <LoadingState label="Cargando cotizaciones..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        badge="Ventas"
        description={`${quotes.length} cotizaciones registradas con seguimiento comercial activo.`}
        actions={
          <>
            <Button
              onClick={() => router.push('/dashboard/quotes/templates')}
              variant="outline"
              size="sm"
              className="h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              Plantillas
            </Button>
            <Button onClick={() => router.push('/dashboard/quotes/new')} size="sm" className="h-9 bg-white text-slate-900 hover:bg-slate-100">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </>
        }
      />

      {backendError && (
        <PanelCard className="border-destructive/40">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Backend no conectado</p>
              <p className="text-xs text-muted-foreground mt-0.5">No se pueden cargar las cotizaciones</p>
            </div>
          </div>
        </PanelCard>
      )}

      <PanelCard>
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por folio, cliente o email"
                className="w-full pl-10 pr-10 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(normalizeStatusFilter(event.target.value))}
                className="w-full px-3 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {QUOTE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between lg:justify-end gap-3 text-sm">
              <span className="text-muted-foreground">Mostrando: {filteredQuotes.length}</span>
              {activeFiltersCount > 0 && (
                <button className="text-primary hover:underline" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className="border-t pt-3 flex flex-wrap items-center gap-2">
            {savingView ? (
              <>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="Nombre de la vista"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <Button size="sm" onClick={handleSaveCurrentView}>Guardar</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSavingView(false)
                    setNewViewName('')
                  }}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSavingView(true)}>
                Guardar vista actual
              </Button>
            )}

            {savedViews.map((view) => (
              <div key={view.id} className="inline-flex items-center rounded-full border px-2 py-1 text-xs">
                <button className="hover:underline" onClick={() => handleApplySavedView(view)}>
                  {view.name}
                </button>
                <button className="ml-2 text-muted-foreground hover:text-foreground" onClick={() => handleDeleteSavedView(view.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </PanelCard>

      <TableShell>
        {filteredQuotes.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={activeFiltersCount > 0 ? 'Sin resultados para esos filtros' : 'No hay cotizaciones registradas'}
              description="Prueba con otra búsqueda o crea una cotización nueva."
              action={
                <Button onClick={() => router.push('/dashboard/quotes/new')} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Cotización
                </Button>
              }
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider"># Cotización</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Piezas</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Válida hasta</th>
                <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                <th className="text-right py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const totalPieces = quote.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
                return (
                  <tr
                    key={quote.id}
                    className="border-b hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm">{quote.quote_number}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{quote.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{quote.customer_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold tabular-nums">{totalPieces}</span>
                      <span className="text-xs text-muted-foreground ml-1">pza{totalPieces !== 1 ? 's' : ''}</span>
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
                        month: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm hidden lg:table-cell">
                      {new Date(quote.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {quote.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(`/dashboard/quotes/new?edit=${quote.id}`)
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(`/dashboard/quotes/${quote.id}`)
                            }}
                          >
                            Ver →
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/dashboard/quotes/${quote.id}`)
                          }}
                        >
                          Ver →
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </TableShell>
    </div>
  )
}
