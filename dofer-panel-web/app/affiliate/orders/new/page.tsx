'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import LoadingState from '@/components/dashboard/LoadingState'
import PageHeader from '@/components/dashboard/PageHeader'
import PanelCard from '@/components/dashboard/PanelCard'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Affiliate, Product } from '@/types'

interface NewRequestForm {
  product_id: string
  product_name: string
  quantity: number
  final_price: string
  priority: 'urgent' | 'normal' | 'low'
  reference_images: string[]
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_notes: string
}

const initialForm: NewRequestForm = {
  product_id: '',
  product_name: '',
  quantity: 1,
  final_price: '',
  priority: 'normal',
  reference_images: [],
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_notes: '',
}

export default function NewAffiliateOrderPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [form, setForm] = useState<NewRequestForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
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
    } catch (error: unknown) {
      setApiError(getErrorMessage(error, 'Error cargando catálogo'))
    } finally {
      setLoadingProducts(false)
    }
  }, [])

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
    const images = await Promise.all(selectedFiles.map(readFileAsDataURL))
    setForm((prev) => ({ ...prev, reference_images: images }))
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
        priority: form.priority,
        reference_images: form.reference_images,
        customer_name: form.customer_name,
        customer_email: form.customer_email || undefined,
        customer_phone: form.customer_phone || undefined,
        customer_notes: form.customer_notes || undefined,
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
          <div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.product_name}
              onChange={(e) => setForm((prev) => ({ ...prev, product_name: e.target.value }))}
              placeholder="Nombre del producto"
              className="px-3 py-2 border rounded-xl bg-background md:col-span-2"
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
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Precio final que le cobrarás a tu cliente</label>
            <input
              type="number"
              min={selectedProduct?.affiliate_min_price || 0}
              step="0.01"
              value={form.final_price}
              onChange={(e) => setForm((prev) => ({ ...prev, final_price: e.target.value }))}
              placeholder="$0.00"
              className="px-3 py-2 border rounded-xl bg-background w-full md:w-60"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Prioridad</span>
              <select
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as NewRequestForm['priority'] }))}
                className="w-full px-3 py-2 border rounded-xl bg-background"
              >
                <option value="normal">Normal</option>
                <option value="urgent" disabled={affiliate?.allow_urgent_orders === false}>Urgente</option>
                <option value="low">Baja</option>
              </select>
              {affiliate?.allow_urgent_orders === false && (
                <span className="mt-1 block text-xs text-muted-foreground">Tu cuenta no tiene pedidos urgentes habilitados.</span>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Imagenes de referencia</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void handleReferenceImages(e.target.files)}
                className="w-full px-3 py-2 border rounded-xl bg-background"
              />
            </label>
          </div>

          {form.reference_images.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Nombre del cliente"
              className="px-3 py-2 border rounded-xl bg-background"
              required
            />
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm((prev) => ({ ...prev, customer_email: e.target.value }))}
              placeholder="Email del cliente (opcional)"
              className="px-3 py-2 border rounded-xl bg-background"
            />
            <input
              type="text"
              value={form.customer_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
              placeholder="Teléfono del cliente (opcional)"
              className="px-3 py-2 border rounded-xl bg-background"
            />
          </div>

          <textarea
            value={form.customer_notes}
            onChange={(e) => setForm((prev) => ({ ...prev, customer_notes: e.target.value }))}
            placeholder="Notas (color, personalización, dirección, etc.)"
            className="w-full px-3 py-2 border rounded-xl bg-background"
            rows={3}
          />

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Registrar pedido'}
          </button>
        </form>
      </PanelCard>
    </div>
  )
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
