'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { imageFileToOptimizedDataURL } from '@/lib/images'
import type { Affiliate, AffiliateOrderRequestDetail, Product } from '@/types'

interface NewRequestForm {
  product_id: string
  product_name: string
  quantity: number
  final_price: string
  customer_amount_paid: string
  customer_payment_method: string
  customer_payment_reference: string
  customer_payment_notes: string
  priority: 'urgent' | 'normal' | 'low'
  reference_images: string[]
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_notes: string
  promised_delivery_date: string
  delivery_method: 'pickup' | 'local_delivery' | 'shipping'
  delivery_address: string
  delivery_notes: string
  duplicated_from_request_id: string
}

const initialForm: NewRequestForm = {
  product_id: '',
  product_name: '',
  quantity: 1,
  final_price: '',
  customer_amount_paid: '',
  customer_payment_method: '',
  customer_payment_reference: '',
  customer_payment_notes: '',
  priority: 'normal',
  reference_images: [],
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_notes: '',
  promised_delivery_date: '',
  delivery_method: 'pickup',
  delivery_address: '',
  delivery_notes: '',
  duplicated_from_request_id: '',
}

export default function NewAffiliateOrderPage() {
  const router = useRouter()
  const duplicateID = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('duplicate') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [form, setForm] = useState<NewRequestForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [processingImages, setProcessingImages] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const [productsResponse, affiliateResponse] = await Promise.all([
        apiClient.get<{ products: Product[] }>('/affiliates/me/products'),
        apiClient.get<Affiliate>('/affiliates/me'),
      ])
      setProducts(productsResponse.products || [])
      setAffiliate(affiliateResponse)
      if (duplicateID) {
        const duplicate = await apiClient.get<AffiliateOrderRequestDetail>(`/affiliates/me/requests/${duplicateID}`).catch(() => null)
        if (duplicate?.request) {
          setForm({
            product_id: duplicate.request.product_id || '',
            product_name: duplicate.request.product_name,
            quantity: duplicate.request.quantity,
            final_price: String(duplicate.request.final_price),
            customer_amount_paid: '',
            customer_payment_method: '',
            customer_payment_reference: '',
            customer_payment_notes: '',
            priority: duplicate.request.priority,
            reference_images: duplicate.request.reference_images || [],
            customer_name: '',
            customer_email: '',
            customer_phone: '',
            customer_notes: duplicate.request.customer_notes || '',
            promised_delivery_date: '',
            delivery_method: duplicate.request.delivery_method || 'pickup',
            delivery_address: duplicate.request.delivery_address || '',
            delivery_notes: duplicate.request.delivery_notes || '',
            duplicated_from_request_id: duplicate.request.id,
          })
        }
      }
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando catálogo'))
    } finally {
      setLoadingProducts(false)
    }
  }, [duplicateID])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const selectedProduct = products.find((p) => p.id === form.product_id)

  const handleSelectProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name: product?.name || prev.product_name,
      final_price: product?.suggested_price
        ? String(product.suggested_price)
        : product?.affiliate_min_price
          ? String(product.affiliate_min_price)
          : prev.final_price,
    }))
  }

  const handleReferenceImages = async (files: FileList | null) => {
    if (!files) return
    const selectedFiles = Array.from(files).slice(0, 6)
    setProcessingImages(true)
    setApiError(null)
    try {
      const images = await Promise.all(selectedFiles.map(imageFileToOptimizedDataURL))
      setForm((prev) => ({ ...prev, reference_images: images }))
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'No se pudieron procesar las imágenes'))
    } finally {
      setProcessingImages(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setApiError(null)

    try {
      await apiClient.post('/affiliates/me/requests', {
        product_id: form.product_id || undefined,
        product_name: form.product_name,
        quantity: form.quantity,
        final_price: Number(form.final_price),
        customer_amount_paid: Number(form.customer_amount_paid || 0),
        customer_payment_method: form.customer_payment_method || undefined,
        customer_payment_reference: form.customer_payment_reference || undefined,
        customer_payment_notes: form.customer_payment_notes || undefined,
        priority: form.priority,
        reference_images: form.reference_images,
        customer_name: form.customer_name,
        customer_email: form.customer_email || undefined,
        customer_phone: form.customer_phone || undefined,
        customer_notes: form.customer_notes || undefined,
        promised_delivery_date: form.promised_delivery_date || undefined,
        delivery_method: form.delivery_method,
        delivery_address: form.delivery_address || undefined,
        delivery_notes: form.delivery_notes || undefined,
        duplicated_from_request_id: form.duplicated_from_request_id || undefined,
      })
      router.push('/affiliate/orders')
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error registrando el pedido'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingProducts) {
    return <LoadingState label="Cargando catálogo..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo pedido"
        badge="Afiliado"
        description="Registra lo que tu cliente quiere. Quedará pendiente de revisión antes de pasar a producción."
      />

      {apiError && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">{apiError}</div>
      )}

      <PanelCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.duplicated_from_request_id && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Pedido duplicado como base. Captura los datos del nuevo cliente antes de registrarlo.
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="mb-3">
              <h2 className="text-lg font-bold">Datos del pedido</h2>
              <p className="text-sm text-muted-foreground">Solo captura lo necesario para revisión.</p>
            </div>

            <label className="mb-1 block text-sm font-medium">Producto del catálogo (opcional)</label>
            <select
              value={form.product_id}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-background"
            >
              <option value="">Producto personalizado (escribe el nombre abajo)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.suggested_price ? ` — sugerido $${p.suggested_price.toFixed(2)}` : ''}
                </option>
              ))}
            </select>
            {selectedProduct?.suggested_price ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Precio sugerido por DOFER: ${selectedProduct.suggested_price.toFixed(2)}. Puedes ajustar el precio final abajo.
              </p>
            ) : null}
            {selectedProduct?.affiliate_min_price ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Precio minimo para este producto: ${selectedProduct.affiliate_min_price.toFixed(2)}.
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px_180px]">
              <input
                type="text"
                value={form.product_name}
                onChange={(e) => setForm((prev) => ({ ...prev, product_name: e.target.value }))}
                placeholder="Nombre del producto"
                className="px-3 py-2 border rounded-xl bg-background"
                required
              />
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                placeholder="Cantidad"
                className="px-3 py-2 border rounded-xl bg-background"
                required
              />
              <input
                type="number"
                min={selectedProduct?.affiliate_min_price || 0}
                step="0.01"
                value={form.final_price}
                onChange={(e) => setForm((prev) => ({ ...prev, final_price: e.target.value }))}
                placeholder="Precio final"
                className="px-3 py-2 border rounded-xl bg-background"
                required
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Nombre del cliente"
                className="px-3 py-2 border rounded-xl bg-background"
                required
              />
              <input
                type="text"
                value={form.customer_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                placeholder="Teléfono del cliente (opcional)"
                className="px-3 py-2 border rounded-xl bg-background"
              />
              <label className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-border bg-background px-3 py-2 hover:bg-accent/40">
                <span className="text-sm font-medium">
                  {form.reference_images.length > 0
                    ? `${form.reference_images.length} foto${form.reference_images.length === 1 ? '' : 's'} agregada${form.reference_images.length === 1 ? '' : 's'}`
                    : 'Agregar fotos'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {processingImages ? 'Optimizando imágenes...' : 'Opcional, máximo 6.'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={processingImages}
                  onChange={(e) => void handleReferenceImages(e.target.files)}
                  className="sr-only"
                />
              </label>
            </div>

            {form.reference_images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
                {form.reference_images.map((image, index) => (
                  <div
                    key={`${image.slice(0, 24)}-${index}`}
                    className="aspect-square rounded-lg border bg-cover bg-center"
                    style={{ backgroundImage: `url(${image})` }}
                    aria-label={`Referencia ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, reference_images: [] }))}
                  className="aspect-square rounded-lg border border-red-300 text-red-600 text-xs hover:bg-red-50"
                >
                  Limpiar
                </button>
              </div>
            )}

            <textarea
              value={form.customer_notes}
              onChange={(e) => setForm((prev) => ({ ...prev, customer_notes: e.target.value }))}
              placeholder="Notas importantes: color, medidas, personalización, dirección, etc."
              className="mt-4 w-full px-3 py-2 border rounded-xl bg-background"
              rows={3}
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold hover:bg-accent/50"
            >
              <span>Opciones avanzadas</span>
              <span className="text-sm text-muted-foreground">{showAdvanced ? 'Ocultar' : 'Agregar pago, entrega y fecha'}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-4 border-t border-border/70 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    type="number"
                    min={0}
                    max={Number(form.final_price || 0)}
                    step="0.01"
                    value={form.customer_amount_paid}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_amount_paid: e.target.value }))}
                    placeholder="Anticipo recibido"
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                  <input
                    type="text"
                    value={form.customer_payment_method}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_payment_method: e.target.value }))}
                    placeholder="Método de pago"
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                  <input
                    type="text"
                    value={form.customer_payment_reference}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_payment_reference: e.target.value }))}
                    placeholder="Referencia de pago"
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_email: e.target.value }))}
                    placeholder="Email del cliente"
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Saldo estimado: ${Math.max(0, Number(form.final_price || 0) - Number(form.customer_amount_paid || 0)).toFixed(2)}
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as NewRequestForm['priority'] }))}
                    className="px-3 py-2 border rounded-xl bg-background"
                  >
                    <option value="normal">Prioridad normal</option>
                    <option value="urgent" disabled={affiliate?.allow_urgent_orders === false}>Urgente</option>
                    <option value="low">Baja</option>
                  </select>
                  <input
                    type="date"
                    value={form.promised_delivery_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, promised_delivery_date: e.target.value }))}
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                  <select
                    value={form.delivery_method}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_method: e.target.value as NewRequestForm['delivery_method'] }))}
                    className="px-3 py-2 border rounded-xl bg-background"
                  >
                    <option value="pickup">Recoge en DOFER</option>
                    <option value="local_delivery">Entrega local</option>
                    <option value="shipping">Envío</option>
                  </select>
                  <input
                    type="text"
                    value={form.delivery_address}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_address: e.target.value }))}
                    placeholder="Dirección"
                    className="px-3 py-2 border rounded-xl bg-background"
                  />
                </div>

                <textarea
                  value={form.delivery_notes || form.customer_payment_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, delivery_notes: e.target.value, customer_payment_notes: e.target.value }))}
                  placeholder="Notas extra de pago o entrega"
                  className="w-full px-3 py-2 border rounded-xl bg-background"
                  rows={2}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || processingImages}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-700 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60"
          >
            {processingImages ? 'Optimizando imágenes...' : submitting ? 'Enviando...' : 'Registrar pedido'}
          </button>
        </form>
      </PanelCard>
    </div>
  )
}
