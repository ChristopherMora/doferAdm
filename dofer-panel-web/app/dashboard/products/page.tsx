'use client'

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'

import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface Product {
  id: string
  sku: string
  name: string
  description?: string
  stl_file_path?: string
  estimated_print_time_minutes?: number
  material?: string
  color?: string
  is_active: boolean
  image_url?: string
  created_at: string
}

interface ProductFormState {
  sku: string
  name: string
  description: string
  stl_file_path: string
  estimated_print_time_minutes: string
  material: string
  color: string
  image_url: string
  is_active: boolean
}

const initialForm: ProductFormState = {
  sku: '',
  name: '',
  description: '',
  stl_file_path: '',
  estimated_print_time_minutes: '',
  material: '',
  color: '',
  image_url: '',
  is_active: true,
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<ProductFormState>(initialForm)
  const [editingID, setEditingID] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductFormState>(initialForm)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return products.filter((product) => {
      const matchText =
        q === '' ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (product.material || '').toLowerCase().includes(q)

      const matchActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && product.is_active) ||
        (activeFilter === 'inactive' && !product.is_active)

      return matchText && matchActive
    })
  }, [products, searchQuery, activeFilter])

  useEffect(() => {
    void loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<{ products: Product[] }>('/products')
      setProducts(response.products || [])
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error cargando productos'))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const payload = buildPayload(createForm)
      await apiClient.post('/products', payload)

      setCreateForm(initialForm)
      setShowCreateForm(false)
      await loadProducts()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error creando producto'))
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (product: Product) => {
    setEditingID(product.id)
    setEditForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      stl_file_path: product.stl_file_path || '',
      estimated_print_time_minutes: product.estimated_print_time_minutes?.toString() || '',
      material: product.material || '',
      color: product.color || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
    })
  }

  const cancelEdit = () => {
    setEditingID(null)
    setEditForm(initialForm)
  }

  const handleSaveEdit = async (productID: string) => {
    setSubmitting(true)
    setError(null)

    try {
      const payload = buildPayload(editForm)
      await apiClient.put(`/products/${productID}`, payload)

      setEditingID(null)
      await loadProducts()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error actualizando producto'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (product: Product) => {
    setSubmitting(true)
    setError(null)

    try {
      await apiClient.patch(`/products/${product.id}/active`, { is_active: !product.is_active })
      await loadProducts()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error cambiando estado de producto'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (productID: string) => {
    if (!confirm('¿Eliminar este producto?')) return

    setSubmitting(true)
    setError(null)

    try {
      await apiClient.delete(`/products/${productID}`)
      await loadProducts()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error eliminando producto'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8">Cargando productos...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground mt-1">
            Catálogo operativo conectado a API (crear, editar, activar y eliminar).
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          {showCreateForm ? 'Cancelar' : '+ Nuevo Producto'}
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por SKU, nombre o material"
          className="px-3 py-2 border rounded-lg"
        />
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <div className="text-sm text-muted-foreground self-center">Total: {filteredProducts.length}</div>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-card border rounded-lg p-4">
          <ProductForm form={createForm} setForm={setCreateForm} />
          <div className="mt-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              Guardar producto
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {filteredProducts.map((product) => {
          const isEditing = editingID === product.id

          return (
            <div key={product.id} className="bg-card border rounded-lg p-4">
              {isEditing ? (
                <>
                  <ProductForm form={editForm} setForm={setEditForm} />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(product.id)}
                      disabled={submitting}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Guardar cambios
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-2 border rounded-lg hover:bg-accent">
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-lg">{product.name}</h2>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                      <p className="text-sm text-muted-foreground">Material: {product.material || 'N/D'}</p>
                      {product.description && <p className="text-sm mt-1">{product.description}</p>}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {product.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div>Color: {product.color || 'N/D'}</div>
                    <div>
                      Tiempo impresión: {product.estimated_print_time_minutes ? `${product.estimated_print_time_minutes} min` : 'N/D'}
                    </div>
                    <div>STL: {product.stl_file_path || 'N/D'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(product)}
                      className="px-3 py-1 text-sm border rounded hover:bg-accent"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className="px-3 py-1 text-sm border rounded hover:bg-accent"
                    >
                      {product.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            No hay productos que coincidan con los filtros.
          </div>
        )}
      </div>
    </div>
  )
}

function ProductForm({
  form,
  setForm,
}: {
  form: ProductFormState
  setForm: Dispatch<SetStateAction<ProductFormState>>
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <input
        type="text"
        value={form.sku}
        onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
        placeholder="SKU"
        className="px-3 py-2 border rounded-lg"
        required
      />
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        placeholder="Nombre"
        className="px-3 py-2 border rounded-lg"
        required
      />
      <input
        type="text"
        value={form.material}
        onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}
        placeholder="Material"
        className="px-3 py-2 border rounded-lg"
      />
      <input
        type="text"
        value={form.color}
        onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
        placeholder="Color"
        className="px-3 py-2 border rounded-lg"
      />

      <input
        type="text"
        value={form.stl_file_path}
        onChange={(e) => setForm((prev) => ({ ...prev, stl_file_path: e.target.value }))}
        placeholder="Ruta STL"
        className="px-3 py-2 border rounded-lg"
      />
      <input
        type="number"
        value={form.estimated_print_time_minutes}
        onChange={(e) => setForm((prev) => ({ ...prev, estimated_print_time_minutes: e.target.value }))}
        placeholder="Tiempo impresión (min)"
        className="px-3 py-2 border rounded-lg"
        min="0"
      />
      <input
        type="url"
        value={form.image_url}
        onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
        placeholder="URL Imagen"
        className="px-3 py-2 border rounded-lg"
      />
      <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
        />
        Activo
      </label>

      <textarea
        value={form.description}
        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        placeholder="Descripción"
        className="md:col-span-4 px-3 py-2 border rounded-lg"
        rows={2}
      />
    </div>
  )
}

function buildPayload(form: ProductFormState) {
  return {
    sku: form.sku.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    stl_file_path: form.stl_file_path.trim() || null,
    estimated_print_time_minutes:
      form.estimated_print_time_minutes.trim() === ''
        ? null
        : Number(form.estimated_print_time_minutes),
    material: form.material.trim() || null,
    color: form.color.trim() || null,
    image_url: form.image_url.trim() || null,
    is_active: form.is_active,
  }
}
