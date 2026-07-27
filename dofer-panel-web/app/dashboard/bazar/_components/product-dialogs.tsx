'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  DialogBackdrop,
  DialogHeader,
} from './dialog'
import {
  MOVEMENT_OPTIONS,
  VARIANT_COLORS,
} from '../_lib/constants'
import {
  productDisplayName,
  productTracksStock,
} from '../_lib/products'
import type {
  BazarProduct,
} from '../_lib/types'

export function ProductDialog({
  product,
  variantSeed,
  creating,
  onClose,
  onSubmit,
}: {
  product?: BazarProduct
  variantSeed?: BazarProduct | null
  creating: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [mode, setMode] = useState<'single' | 'variants'>(
    variantSeed ? 'variants' : 'single',
  )
  const [variantRows, setVariantRows] = useState(() =>
    variantSeed
      ? [{ id: 'variant-1', color: VARIANT_COLORS[1] }]
      : [
          { id: 'variant-1', color: VARIANT_COLORS[0] },
          { id: 'variant-2', color: VARIANT_COLORS[1] },
        ],
  )
  const buildingVariants = !product && mode === 'variants'
  const groupedSeed = Boolean(variantSeed?.variant_group_id)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-t-lg border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-lg"
      >
        <input
          type="hidden"
          name="product_mode"
          value={buildingVariants ? 'variants' : 'single'}
        />
        {buildingVariants && (
          <input
            type="hidden"
            name="variant_ids"
            value={variantRows.map((row) => row.id).join(',')}
          />
        )}
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {product
                ? product.external_id
                : variantSeed
                  ? productDisplayName(variantSeed)
                  : 'Catálogo manual'}
            </p>
            <h2 id="product-dialog-title" className="mt-1 text-xl font-semibold">
              {product
                ? 'Editar producto'
                : variantSeed
                  ? 'Agregar variante'
                  : 'Agregar producto'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!product && !variantSeed && (
            <div className="grid grid-cols-2 rounded-md border border-input p-1">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`h-9 rounded-sm text-sm font-medium ${
                  mode === 'single'
                    ? 'bg-foreground text-background'
                    : 'hover:bg-accent'
                }`}
              >
                Producto único
              </button>
              <button
                type="button"
                onClick={() => setMode('variants')}
                className={`h-9 rounded-sm text-sm font-medium ${
                  mode === 'variants'
                    ? 'bg-foreground text-background'
                    : 'hover:bg-accent'
                }`}
              >
                Varios colores
              </button>
            </div>
          )}

          {groupedSeed ? (
            <div className="border-y border-border py-3">
              <input type="hidden" name="name" value={variantSeed?.name || ''} />
              <input
                type="hidden"
                name="category"
                value={variantSeed?.category || ''}
              />
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Modelo
              </p>
              <p className="mt-1 font-semibold">{variantSeed?.name}</p>
              <p className="text-sm text-muted-foreground">
                {variantSeed?.category || 'Sin categoría'}
              </p>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                {buildingVariants || product?.variant_group_id
                  ? 'Nombre del modelo'
                  : 'Nombre del producto'}
              </span>
              <input
                name="name"
                required
                autoFocus
                maxLength={160}
                readOnly={Boolean(product?.variant_group_id)}
                defaultValue={product?.name || variantSeed?.name}
                placeholder={buildingVariants ? 'Ej. Capibara' : 'Ej. Capibara café'}
                className="h-11 w-full rounded-md border border-input bg-background px-3 read-only:bg-muted"
              />
            </label>
          )}

          {(!buildingVariants || !groupedSeed) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {!buildingVariants && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Código / SKU (opcional)
                </span>
                <input
                  name="sku"
                  maxLength={80}
                  defaultValue={product?.external_id}
                  placeholder="Ej. CAP-01"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
            )}
            {!groupedSeed && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Categoría</span>
              <input
                name="category"
                maxLength={100}
                readOnly={Boolean(product?.variant_group_id)}
                defaultValue={product?.category || variantSeed?.category}
                placeholder="Ej. Doflins"
                className="h-11 w-full rounded-md border border-input bg-background px-3 read-only:bg-muted"
              />
            </label>
            )}
          </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                {buildingVariants ? 'Precio base' : 'Precio'}
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  name="price"
                  type="number"
                  required
                  min="0"
                  max="999999999"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={product?.price ?? variantSeed?.price}
                  placeholder="0.00"
                  className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
                />
              </div>
            </label>
            {!product && !buildingVariants ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Stock inicial (opcional)
                </span>
                <input
                  name="stock"
                  type="number"
                  min="0"
                  max="999999"
                  step="1"
                  inputMode="numeric"
                  placeholder="Sin control"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Déjalo vacío para vender sin descontar existencias.
                </span>
              </label>
            ) : product ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {productTracksStock(product) ? 'Existencia actual' : 'Control de stock'}
                </p>
                <p className="font-semibold">
                  {productTracksStock(product) ? `${product.stock} unidades` : 'Venta libre'}
                </p>
              </div>
            ) : (
              <div className="self-end text-xs text-muted-foreground">
                Cada variante puede sobrescribir este precio.
              </div>
            )}
          </div>

          {buildingVariants && variantSeed && !variantSeed.variant_group_id && (
            <div className="space-y-3 border-y border-border py-4">
              <div>
                <p className="text-sm font-semibold">Producto actual</p>
                <p className="text-xs text-muted-foreground">
                  Identifica su color para incluirlo en el mismo modelo.
                </p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Variante actual
                  </span>
                  <input
                    name="current_variant_name"
                    required
                    maxLength={80}
                    defaultValue={variantSeed.variant_name}
                    placeholder="Ej. Café"
                    className="h-11 w-full rounded-md border border-input bg-background px-3"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Color</span>
                  <input
                    name="current_variant_color"
                    type="color"
                    defaultValue={variantSeed.variant_color || VARIANT_COLORS[0]}
                    className="h-11 w-full rounded-md border border-input bg-background p-1"
                    title="Color de la variante actual"
                  />
                </label>
              </div>
            </div>
          )}

          {product?.variant_group_id && (
            <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Variante</span>
                <input
                  name="variant_name"
                  required
                  maxLength={80}
                  defaultValue={product.variant_name}
                  placeholder="Ej. Café"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Color</span>
                <input
                  name="variant_color"
                  type="color"
                  defaultValue={product.variant_color || VARIANT_COLORS[0]}
                  className="h-11 w-full rounded-md border border-input bg-background p-1"
                  title="Color de la variante"
                />
              </label>
            </div>
          )}

          {buildingVariants && (
            <section className="space-y-3 border-y border-border py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {variantSeed ? 'Nueva variante' : 'Variantes'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Stock y código independientes. Sin stock se vende libre.
                  </p>
                </div>
                {!variantSeed && (
                  <button
                    type="button"
                    onClick={() =>
                      setVariantRows((current) => [
                        ...current,
                        {
                          id: `variant-${Date.now()}`,
                          color: VARIANT_COLORS[current.length % VARIANT_COLORS.length],
                        },
                      ])
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                )}
              </div>

              {variantRows.map((row, index) => (
                <div key={row.id} className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Variante {index + 1}
                    </span>
                    {!variantSeed && variantRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVariantRows((current) =>
                            current.filter((item) => item.id !== row.id),
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                        title="Quitar variante"
                        aria-label={`Quitar variante ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Nombre</span>
                      <input
                        name={`variant_name_${row.id}`}
                        required
                        autoFocus={Boolean(variantSeed && index === 0 && groupedSeed)}
                        maxLength={80}
                        placeholder="Ej. Rosa"
                        className="h-11 w-full rounded-md border border-input bg-background px-3"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Color</span>
                      <input
                        name={`variant_color_${row.id}`}
                        type="color"
                        defaultValue={row.color}
                        className="h-11 w-full rounded-md border border-input bg-background p-1"
                        title={`Color de la variante ${index + 1}`}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block min-w-0">
                      <span className="mb-1.5 block truncate text-sm font-medium">
                        SKU
                      </span>
                      <input
                        name={`variant_sku_${row.id}`}
                        maxLength={80}
                        placeholder="Automático"
                        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1.5 block truncate text-sm font-medium">
                        Stock
                      </span>
                      <input
                        name={`variant_stock_${row.id}`}
                        type="number"
                        min="0"
                        max="999999"
                        step="1"
                        inputMode="numeric"
                        placeholder="Libre"
                        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1.5 block truncate text-sm font-medium">
                        Precio
                      </span>
                      <input
                        name={`variant_price_${row.id}`}
                        type="number"
                        min="0"
                        max="999999999"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Mismo"
                        className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </section>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {buildingVariants
                ? variantSeed
                  ? 'URL de imagen para esta variante (opcional)'
                  : 'URL de imagen del modelo (opcional)'
                : 'URL de imagen (opcional)'}
            </span>
            <input
              name="image_url"
              type="text"
              defaultValue={
                product?.image_url?.startsWith('http')
                  ? product.image_url
                  : ''
              }
              placeholder="https://..."
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
          <label className="block rounded-md border border-dashed border-input p-3">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4" />
              {buildingVariants
                ? variantSeed
                  ? 'Subir imagen de esta variante'
                  : 'Subir imagen del modelo'
                : 'Subir imagen'}
            </span>
            <input name="image_file" type="file" accept="image/*" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:font-medium" />
          </label>
          {product && (
            <>
              <label className="flex items-center gap-3 text-sm">
                <input name="remove_image" type="checkbox" className="h-4 w-4 rounded border-input" />
                Quitar imagen actual
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Stock al sincronizar</span>
                  <select
                    name="stock_sync_policy"
                    defaultValue={product.stock_sync_policy || 'manual'}
                    className="h-11 w-full rounded-md border border-input bg-background px-3"
                  >
                    <option value="manual">Conservar ajuste manual</option>
                    <option value="sheets">Usar valor de Sheets</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-md border border-input px-3 py-2.5 text-sm">
                  <input name="active" type="checkbox" defaultChecked={product.active} className="h-4 w-4 rounded border-input" />
                  Producto activo
                </label>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 z-10 border-t border-border bg-muted/95 px-5 py-4 backdrop-blur">
          <button type="submit" disabled={creating} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : product ? <Check className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            {product
              ? 'Guardar cambios'
              : variantSeed
                ? 'Guardar variante'
                : buildingVariants
                  ? 'Guardar variantes'
                  : 'Guardar producto'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function StockAdjustmentDialog({
  product,
  saving,
  onClose,
  onSubmit,
}: {
  product: BazarProduct
  saving: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_OPTIONS)[number]['value']>('inventory_entry')
  const manual = movementType === 'manual_adjustment'

  return (
    <DialogBackdrop onClose={onClose}>
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader
          eyebrow={`${productDisplayName(product)} · ${productTracksStock(product) ? `${product.stock} disponibles` : 'Venta libre'}`}
          title="Ajustar inventario"
          onClose={onClose}
        />
        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Movimiento</span>
            <select
              name="movement_type"
              value={movementType}
              onChange={(event) => setMovementType(event.target.value as typeof movementType)}
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            >
              {MOVEMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {manual ? 'Cambio de stock (+ / -)' : 'Cantidad'}
            </span>
            <input
              key={movementType}
              name="quantity"
              type="number"
              required
              min={manual ? -999999 : 1}
              max="999999"
              defaultValue={manual ? '' : 1}
              placeholder={manual ? 'Ej. -2 o 5' : '1'}
              className="h-11 w-full rounded-md border border-input bg-background px-3"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Motivo o nota</span>
            <textarea name="reason" rows={3} maxLength={300} className="w-full resize-none rounded-md border border-input bg-background p-3" placeholder="Detalle del movimiento" />
          </label>
        </div>
        <div className="border-t border-border bg-muted/45 px-5 py-4">
          <button type="submit" disabled={saving} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Registrar movimiento
          </button>
        </div>
      </form>
    </DialogBackdrop>
  )
}
