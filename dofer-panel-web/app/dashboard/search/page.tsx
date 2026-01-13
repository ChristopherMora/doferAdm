'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Filter } from 'lucide-react';
import type { Order, Quote } from '@/types';

type SearchType = 'orders' | 'quotes';

interface SearchFilters {
  query: string;
  status: string;
  customer: string;
  operator?: string;
  dateFrom: string;
  dateTo: string;
  minTotal?: string;
  maxTotal?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [searchType, setSearchType] = useState<SearchType>('orders');
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: '',
    customer: '',
    operator: '',
    dateFrom: '',
    dateTo: '',
    minTotal: '',
    maxTotal: '',
  });
  const [results, setResults] = useState<(Order | Quote)[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (filters.query) params.append('query', filters.query);
      if (filters.status) params.append('status', filters.status);
      if (filters.customer) params.append('customer', filters.customer);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      
      if (searchType === 'orders' && filters.operator) {
        params.append('operator', filters.operator);
      }
      
      if (searchType === 'quotes') {
        if (filters.minTotal) params.append('min_total', filters.minTotal);
        if (filters.maxTotal) params.append('max_total', filters.maxTotal);
      }

      const endpoint = searchType === 'orders' ? '/orders/search' : '/quotes/search';
      const response = await apiClient.get(`${endpoint}?${params.toString()}`) as any;
      
      const data = searchType === 'orders' ? response.data.orders : response.data.quotes;
      setResults(data || []);
      setTotalResults(response.data.total || 0);
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      query: '',
      status: '',
      customer: '',
      operator: '',
      dateFrom: '',
      dateTo: '',
      minTotal: '',
      maxTotal: '',
    });
    setResults([]);
    setTotalResults(0);
  };

  const getStatusBadgeColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'default',
      printing: 'secondary',
      post: 'secondary',
      packed: 'secondary',
      ready: 'default',
      delivered: 'outline',
      cancelled: 'destructive',
      pending: 'default',
      approved: 'outline',
      rejected: 'destructive',
    };
    return variants[status] || 'outline';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Nueva',
      printing: 'Imprimiendo',
      post: 'Post-proceso',
      packed: 'Empaquetado',
      ready: 'Listo',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Búsqueda Avanzada</h1>
        <p className="text-sm text-muted-foreground mt-1">Busca órdenes y cotizaciones con filtros combinados</p>
      </div>

      {/* Tipo de búsqueda */}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setSearchType('orders');
            setResults([]);
            setTotalResults(0);
          }}
          variant={searchType === 'orders' ? 'default' : 'outline'}
          size="sm"
        >
          Órdenes
        </Button>
        <Button
          onClick={() => {
            setSearchType('quotes');
            setResults([]);
            setTotalResults(0);
          }}
          variant={searchType === 'quotes' ? 'default' : 'outline'}
          size="sm"
        >
          Cotizaciones
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium uppercase tracking-wider">Filtros</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Búsqueda general
              </label>
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder="Nombre, número, cliente..."
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Estado
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                {searchType === 'orders' ? (
                  <>
                    <option value="new">Nueva</option>
                    <option value="printing">Imprimiendo</option>
                    <option value="post">Post-proceso</option>
                    <option value="packed">Empaquetado</option>
                    <option value="ready">Listo</option>
                    <option value="delivered">Entregado</option>
                    <option value="cancelled">Cancelado</option>
                  </>
                ) : (
                  <>
                    <option value="pending">Pendiente</option>
                    <option value="approved">Aprobado</option>
                    <option value="rejected">Rechazado</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Cliente
              </label>
              <input
                type="text"
                value={filters.customer}
                onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                placeholder="Nombre del cliente"
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {searchType === 'orders' && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                  Operador
                </label>
                <input
                  type="text"
                  value={filters.operator}
                  onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
                  placeholder="Nombre del operador"
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Fecha desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                Fecha hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {searchType === 'quotes' && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Total mínimo
                  </label>
                  <input
                    type="number"
                    value={filters.minTotal}
                    onChange={(e) => setFilters({ ...filters, minTotal: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Total máximo
                  </label>
                  <input
                    type="number"
                    value={filters.maxTotal}
                    onChange={(e) => setFilters({ ...filters, maxTotal: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSearch} disabled={loading}>
              <SearchIcon className="h-4 w-4 mr-2" />
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            <Button onClick={handleClearFilters} variant="outline">
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium uppercase tracking-wider">
              Resultados {totalResults > 0 && `(${totalResults})`}
            </h2>
          </div>

          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-sm text-muted-foreground mt-3">Buscando...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-16 text-center">
              <SearchIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No se encontraron resultados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {searchType === 'orders' ? (
                      <>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Número</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Producto</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Operador</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acciones</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Número</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliente</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">Total</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">Acciones</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/50">
                      {searchType === 'orders' ? (
                        <>
                          <td className="py-3 px-4 text-sm font-mono">{(item as Order).order_number}</td>
                          <td className="py-3 px-4 text-sm">{(item as Order).product_name}</td>
                          <td className="py-3 px-4 text-sm">{item.customer_name}</td>
                          <td className="py-3 px-4 text-sm hidden md:table-cell">{(item as Order).assigned_to || '-'}</td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadgeColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(item.created_at)}</td>
                          <td className="py-3 px-4">
                            <Button
                              onClick={() => router.push(`/dashboard/orders/${item.id}`)}
                              variant="ghost"
                              size="sm"
                            >
                              Ver
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-sm font-mono">{(item as Quote).quote_number}</td>
                          <td className="py-3 px-4 text-sm">{item.customer_name}</td>
                          <td className="py-3 px-4 text-sm font-medium tabular-nums hidden md:table-cell">
                            {formatCurrency((item as Quote).total)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadgeColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground hidden lg:table-cell">{formatDate(item.created_at)}</td>
                          <td className="py-3 px-4">
                            <Button
                              onClick={() => router.push(`/dashboard/quotes/${item.id}`)}
                              variant="ghost"
                              size="sm"
                            >
                              Ver
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
