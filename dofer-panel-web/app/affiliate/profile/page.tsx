'use client'

import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate } from '@/types'

export default function AffiliateProfilePage() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const me = await apiClient.get<Affiliate>('/affiliates/me')
      setAffiliate(me)
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando tu perfil'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <LoadingState label="Cargando tu perfil..." />
  }

  if (!affiliate) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mi perfil" badge="Afiliado" />
        {apiError && <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" badge="Afiliado" description="Tus datos de contacto y condiciones de comisión." />

      <PanelCard className="space-y-4">
        <Field label="Nombre" value={affiliate.display_name} />
        <Field label="Email" value={affiliate.email} />
        <Field label="Teléfono" value={affiliate.phone || 'Sin definir'} />
        <Field
          label="Comisión"
          value={
            affiliate.commission_type === 'percentage'
              ? `${affiliate.commission_value}% por pedido aprobado`
              : `$${affiliate.commission_value.toFixed(2)} fijo por pedido aprobado`
          }
        />
        <Field label="Estado" value={affiliate.status === 'active' ? 'Activo' : 'Suspendido'} />
        <p className="text-xs text-muted-foreground">
          Tu comisión y estado son configurados por DOFER. Si necesitas un cambio, contáctalos directamente.
        </p>
      </PanelCard>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
