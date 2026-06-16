'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import EmptyState from '@/components/dashboard/EmptyState'
import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate } from '@/types'

interface CreateAffiliateForm {
  display_name: string
  email: string
  phone: string
  commission_type: 'percentage' | 'fixed'
  commission_value: number
  notes: string
}

const initialForm: CreateAffiliateForm = {
  display_name: '',
  email: '',
  phone: '',
  commission_type: 'percentage',
  commission_value: 10,
  notes: '',
}

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState<CreateAffiliateForm>(initialForm)
  const [apiError, setApiError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; temporary_password: string } | null>(null)

  const loadAffiliates = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const response = await apiClient.get<{ affiliates: Affiliate[] }>('/affiliates')
      setAffiliates(response.affiliates || [])
    } catch (error: unknown) {
      setApiError(`Error cargando afiliados: ${getErrorMessage(error, 'Error desconocido')}`)
      setAffiliates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAffiliates()
  }, [loadAffiliates])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setApiError(null)
    setCreatedCredentials(null)

    try {
      const response = await apiClient.post<{ affiliate: Affiliate; temporary_password: string }>('/affiliates', form)
      setCreatedCredentials({ email: response.affiliate.email, temporary_password: response.temporary_password })
      setForm(initialForm)
      setShowCreateForm(false)
      await loadAffiliates()
    } catch (error: unknown) {
      setApiError(`Error creando afiliado: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState label="Cargando afiliados..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Afiliados"
        badge="Ventas"
        description="Personas externas que registran pedidos de sus propios clientes para que tú los fabriques."
        actions={
          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="px-4 py-2 bg-white/15 text-white rounded-xl hover:bg-white/25"
          >
            {showCreateForm ? 'Cancelar' : '+ Nuevo afiliado'}
          </button>
        }
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      {createdCredentials && (
        <div className="p-4 rounded-lg border border-green-300 bg-green-50 text-green-900 text-sm space-y-1">
          <p className="font-semibold">Afiliado creado. Comparte estas credenciales de forma segura — no se mostrarán de nuevo:</p>
          <p>Email: <code className="font-mono">{createdCredentials.email}</code></p>
          <p>Contraseña temporal: <code className="font-mono">{createdCredentials.temporary_password}</code></p>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="panel-surface rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
            placeholder="Nombre del afiliado"
            className="px-3 py-2 border rounded-xl bg-background"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email (será su usuario de login)"
            className="px-3 py-2 border rounded-xl bg-background"
            required
          />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Teléfono"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <select
            value={form.commission_type}
            onChange={(e) => setForm((prev) => ({ ...prev, commission_type: e.target.value as 'percentage' | 'fixed' }))}
            className="px-3 py-2 border rounded-xl bg-background"
          >
            <option value="percentage">Comisión por porcentaje</option>
            <option value="fixed">Comisión fija por pedido</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.commission_value}
            onChange={(e) => setForm((prev) => ({ ...prev, commission_value: Number(e.target.value) }))}
            placeholder={form.commission_type === 'percentage' ? 'Comisión %' : 'Comisión $ por pedido'}
            className="px-3 py-2 border rounded-xl bg-background"
            required
          />
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notas internas (opcional)"
            className="px-3 py-2 border rounded-xl bg-background"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60 md:col-span-3"
          >
            {submitting ? 'Creando...' : 'Crear afiliado'}
          </button>
        </form>
      )}

      <PanelCard>
        <h2 className="text-xl font-bold mb-4">Listado</h2>
        <div className="space-y-3">
          {affiliates.map((affiliate) => (
            <Link
              key={affiliate.id}
              href={`/dashboard/affiliates/${affiliate.id}`}
              className="block rounded-xl border border-border/70 bg-background/70 p-4 hover:bg-accent/50 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{affiliate.display_name}</h3>
                  <p className="text-sm text-muted-foreground">{affiliate.email}{affiliate.phone ? ` · ${affiliate.phone}` : ''}</p>
                </div>
                <div className="text-right text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                      affiliate.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {affiliate.status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                  <p className="text-muted-foreground mt-1">
                    {affiliate.commission_type === 'percentage'
                      ? `${affiliate.commission_value}% por pedido`
                      : `$${affiliate.commission_value} fijo por pedido`}
                  </p>
                </div>
              </div>
            </Link>
          ))}

          {affiliates.length === 0 && (
            <EmptyState title="No hay afiliados registrados" description="Crea el primer afiliado para empezar a recibir sus pedidos." />
          )}
        </div>
      </PanelCard>
    </div>
  )
}
