'use client'

import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Affiliate } from '@/types'

export default function AffiliateProfilePage() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingPassword, setSavingPassword] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

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

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!affiliate) return

    setSavingPassword(true)
    setApiError(null)
    setPasswordMessage(null)

    try {
      if (passwordForm.new_password.length < 8) {
        throw new Error('La nueva contraseña debe tener al menos 8 caracteres')
      }
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error('La confirmación no coincide con la nueva contraseña')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: affiliate.email,
        password: passwordForm.current_password,
      })
      if (signInError) {
        throw new Error('La contraseña actual no es correcta')
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.new_password,
      })
      if (updateError) {
        throw updateError
      }

      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setPasswordMessage('Contraseña actualizada correctamente')
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error actualizando contraseña'))
    } finally {
      setSavingPassword(false)
    }
  }

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

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}
      {passwordMessage && (
        <div className="p-3 rounded-lg border border-green-300 bg-green-50 text-green-800 text-sm">{passwordMessage}</div>
      )}

      <PanelCard className="space-y-4">
        <Field label="Nombre" value={affiliate.display_name} />
        <Field label="Email" value={affiliate.email} />
        <Field label="Teléfono" value={affiliate.phone || 'Sin definir'} />
        <Field label="Codigo de afiliado" value={affiliate.referral_code} />
        <Field
          label="Solicitudes abiertas"
          value={affiliate.max_pending_requests > 0 ? `Máximo ${affiliate.max_pending_requests}` : 'Sin límite definido'}
        />
        <Field
          label="Pedidos urgentes"
          value={affiliate.allow_urgent_orders ? 'Permitidos' : 'No disponibles'}
        />
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

      <PanelCard>
        <h2 className="text-xl font-bold mb-4">Cambiar contraseña</h2>
        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="password"
            value={passwordForm.current_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))}
            placeholder="Contraseña actual o temporal"
            className="px-3 py-2 border rounded-xl bg-background"
            required
          />
          <input
            type="password"
            value={passwordForm.new_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
            placeholder="Nueva contraseña"
            className="px-3 py-2 border rounded-xl bg-background"
            minLength={8}
            required
          />
          <input
            type="password"
            value={passwordForm.confirm_password}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
            placeholder="Confirmar nueva contraseña"
            className="px-3 py-2 border rounded-xl bg-background"
            minLength={8}
            required
          />
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60 md:col-span-3"
          >
            {savingPassword ? 'Actualizando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
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
