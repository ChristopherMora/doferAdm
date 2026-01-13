'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
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

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      printing: 'bg-yellow-100 text-yellow-800',
      post: 'bg-purple-100 text-purple-800',
      packed: 'bg-indigo-100 text-indigo-800',
      ready: 'bg-green-100 text-green-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Búsqueda Avanzada</h1>
        <p className="text-gray-600 mt-2">Busca órdenes y cotizaciones con filtros combinados</p>
      </div>

      {/* Search Type Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => {
            setSearchType('orders');
            setResults([]);
            setTotalResults(0);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            searchType === 'orders'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Órdenes
        </button>
        <button
          onClick={() => {
            setSearchType('quotes');
            setResults([]);
            setTotalResults(0);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            searchType === 'quotes'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cotizaciones
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* General Query */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Búsqueda general
            </label>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Nombre, número, cliente..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={filters.customer}
              onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Operator (only for orders) */}
          {searchType === 'orders' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operador
              </label>
              <input
                type="text"
                value={filters.operator}
                onChange={(e) => setFilters({ ...filters, operator: e.target.value })}
                placeholder="Nombre del operador"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha desde
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Min Total (only for quotes) */}
          {searchType === 'quotes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total mínimo
              </label>
              <input
                type="number"
                value={filters.minTotal}
                onChange={(e) => setFilters({ ...filters, minTotal: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Max Total (only for quotes) */}
          {searchType === 'quotes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total máximo
              </label>
              <input
                type="number"
                value={filters.maxTotal}
                onChange={(e) => setFilters({ ...filters, maxTotal: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            onClick={handleClearFilters}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Resultados {totalResults > 0 && `(${totalResults})`}
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Buscando...</div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No se encontraron resultados. Ajusta los filtros y busca nuevamente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {searchType === 'orders' ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operador</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {searchType === 'orders' ? (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900">{(item as Order).order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{(item as Order).product_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{(item as Order).assigned_to || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.created_at)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(`/dashboard/orders/${item.id}`)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Ver detalles
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900">{(item as Quote).quote_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.customer_name}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {formatCurrency((item as Quote).total)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.created_at)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(`/dashboard/quotes/${item.id}`)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Ver detalles
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
