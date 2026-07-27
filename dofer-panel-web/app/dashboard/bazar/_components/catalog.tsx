'use client'

import {
  AlertTriangle,
  CloudOff,
  CopyPlus,
  ImageOff,
  Layers3,
  LoaderCircle,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  PackageX,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingCart,
  Star,
} from 'lucide-react'
import {
  moneyFormatter,
} from '../_lib/format'
import {
  productDisplayName,
  productTracksStock,
  variantLabel,
} from '../_lib/products'
import { ProductImage } from './product-image'
import type {
  BazarProduct,
  ProductGroup,
  SyncStatus,
} from '../_lib/types'

export function Metric({
  label,
  value,
  emphasized = false,
  className = '',
}: {
  label: string
  value: string
  emphasized?: boolean
  className?: string
}) {
  return (
    <div className={`min-w-0 border-r border-border p-3 last:border-r-0 md:p-4 ${className}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate font-semibold ${emphasized ? 'text-xl text-primary' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  )
}

export function SyncNotice({
  status,
  onRetry,
  canRetry,
}: {
  status: SyncStatus
  onRetry: () => void
  canRetry: boolean
}) {
  const notConfigured = status.status === 'not_configured'
  const isError = status.status === 'error'
  return (
    <div className={`flex flex-col gap-3 border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
      isError
        ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
        : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
    }`}>
      <span className="flex items-start gap-2">
        {notConfigured ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {notConfigured
            ? 'Modo manual activo. Las ventas se guardarán en el sistema.'
            : status.last_error || `${status.pending_sales + status.failed_sales} ventas requieren sincronización.`}
        </span>
      </span>
      {!notConfigured && canRetry && (
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-current px-3 font-medium">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  )
}

export function ProductCard({
  group,
  product,
  disabled,
  canEdit,
  favorite,
  freeing,
  cashMode = false,
  onSelect,
  onSell,
  onMultiple,
  onCart,
  onEdit,
  onAdjust,
  onAddVariant,
  onFavorite,
  onFreeSale,
}: {
  group: ProductGroup
  product: BazarProduct
  disabled: boolean
  canEdit: boolean
  favorite: boolean
  freeing: boolean
  cashMode?: boolean
  onSelect: (product: BazarProduct) => void
  onSell: () => void
  onMultiple: () => void
  onCart: () => void
  onEdit: () => void
  onAdjust: () => void
  onAddVariant: () => void
  onFavorite: () => void
  onFreeSale: () => void
}) {
  const soldOut = productTracksStock(product) && product.stock === 0
  const lowStock = productTracksStock(product) && product.stock > 0 && product.stock <= 2
  const unavailable = disabled || soldOut
  // Agotado por inventario en cero: se puede destrabar en un toque en vez de
  // quedar sin forma de cobrar durante la venta.
  const canFreeSale = soldOut && product.active && canEdit && !disabled
  const hasVariants = group.variants.length > 1 || Boolean(product.variant_group_id)
  const activeVariants = group.variants.filter((variant) => variant.active)
  const trackedVariants = activeVariants.filter(productTracksStock)
  const totalStock = trackedVariants.reduce((total, variant) => total + variant.stock, 0)
  const groupSoldOut =
    activeVariants.length === 0 ||
    activeVariants.every(
      (variant) => productTracksStock(variant) && variant.stock === 0,
    )
  const displayedVariants = [
    product,
    ...group.variants.filter((variant) => variant.id !== product.id),
  ]
  const imageProduct =
    product.image_url || product.has_image
      ? product
      : group.variants.find((variant) => variant.image_url || variant.has_image)

  return (
    <article className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className={`relative overflow-hidden bg-muted ${cashMode ? "aspect-[4/3]" : "aspect-square"}`}>
        {imageProduct ? (
          <ProductImage product={imageProduct} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-xs font-semibold ${
          activeVariants.length === 0
            ? 'bg-zinc-700 text-white'
            : groupSoldOut
            ? 'bg-red-600 text-white'
            : !hasVariants && lowStock
              ? 'bg-amber-400 text-amber-950'
              : 'bg-emerald-600 text-white'
        }`}>
          {activeVariants.length === 0
            ? 'Inactivo'
            : groupSoldOut
            ? 'Agotado'
            : hasVariants
              ? trackedVariants.length > 0
                ? `${group.variants.length} variantes · ${totalStock} uds`
                : `${group.variants.length} variantes`
            : !productTracksStock(product)
              ? 'Venta libre'
            : lowStock
              ? `Quedan ${product.stock}`
              : `${product.stock} disponibles`}
        </span>
        <button
          type="button"
          onClick={onFavorite}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-background/95 shadow-sm hover:bg-background"
          title={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          aria-label={favorite ? `Quitar ${productDisplayName(product)} de favoritos` : `Agregar ${productDisplayName(product)} a favoritos`}
        >
          <Star className={`h-4 w-4 ${favorite ? 'fill-current text-amber-500' : ''}`} />
        </button>
      </div>

      <div className={cashMode ? "space-y-2 p-2" : "space-y-3 p-3"}>
        <div className="min-w-0">
          <p className={`line-clamp-2 font-semibold leading-5 ${cashMode ? "min-h-10 text-sm" : "min-h-10 text-sm"}`}>{group.name}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            {!cashMode && (
              <span className="truncate text-xs text-muted-foreground">{product.category || 'Sin categoría'}</span>
            )}
            <span className={`shrink-0 font-semibold text-primary ${cashMode ? 'text-lg' : ''}`}>
              {moneyFormatter.format(product.price)}
            </span>
          </div>
        </div>

        {hasVariants && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {displayedVariants.map((variant) => {
              const variantSoldOut =
                productTracksStock(variant) && variant.stock === 0
              const selected = variant.id === product.id
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => onSelect(variant)}
                  aria-pressed={selected}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background hover:bg-accent'
                  } ${!variant.active || variantSoldOut ? 'opacity-50' : ''}`}
                  title={`${variantLabel(variant)} · ${
                    !variant.active
                      ? 'Inactivo'
                      : !productTracksStock(variant)
                        ? 'Venta libre'
                        : `${variant.stock} disponibles`
                  }`}
                >
                  {variant.variant_color && (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/15"
                      style={{ backgroundColor: variant.variant_color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="max-w-20 truncate">{variantLabel(variant)}</span>
                  {productTracksStock(variant) && (
                    <span className="text-muted-foreground">{variant.stock}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="space-y-2">
          {canFreeSale ? (
            <button
              type="button"
              onClick={onFreeSale}
              disabled={freeing}
              className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-md border border-primary bg-background px-2 font-semibold text-primary hover:bg-accent disabled:opacity-50 ${cashMode ? "h-12 text-sm" : "h-11 text-sm"}`}
              title={`Vender ${productDisplayName(product)} sin descontar existencias`}
            >
              {freeing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <PackageOpen className="h-4 w-4" />
              )}
              <span className="truncate">Vender sin stock</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSell}
              disabled={unavailable}
              className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-md bg-primary px-2 font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${cashMode ? "h-12 text-sm" : "h-11 text-sm"}`}
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">
                {!product.active
                  ? 'Inactivo'
                  : soldOut
                    ? 'Agotado'
                    : hasVariants
                      ? `+1 ${variantLabel(product)}`
                      : '+1 vendido'}
              </span>
            </button>
          )}
          <div className={`grid gap-1.5 ${cashMode ? "grid-cols-2" : "grid-cols-5"}`}>
            <button
              type="button"
              onClick={onCart}
              disabled={unavailable}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title="Agregar al carrito"
              aria-label={`Agregar ${productDisplayName(product)} al carrito`}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMultiple}
              disabled={unavailable}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title="Vender varias unidades"
              aria-label={`Vender varias unidades de ${productDisplayName(product)}`}
            >
              <Layers3 className="h-4 w-4" />
            </button>
            {!cashMode && (
            <>
            <button
              type="button"
              onClick={onAdjust}
              disabled={!canEdit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
              title="Ajustar inventario"
              aria-label={`Ajustar inventario de ${productDisplayName(product)}`}
            >
              <PackagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={!canEdit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
              title="Editar producto"
              aria-label={`Editar ${productDisplayName(product)}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onAddVariant}
              disabled={!canEdit}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
              title="Agregar otra variante"
              aria-label={`Agregar otra variante de ${group.name}`}
            >
              <CopyPlus className="h-4 w-4" />
            </button>
            </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function EmptyCatalog({
  hasProducts,
  configured,
  onSync,
  canSync,
}: {
  hasProducts: boolean
  configured: boolean
  onSync: () => void
  canSync: boolean
}) {
  return (
    <div className="border border-dashed border-border px-5 py-12 text-center">
      {hasProducts ? <PackageX className="mx-auto h-10 w-10 text-muted-foreground" /> : <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" />}
      <h3 className="mt-3 font-semibold">{hasProducts ? 'No hay coincidencias' : 'El catálogo está vacío'}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {hasProducts
          ? 'Cambia la búsqueda o los filtros.'
          : configured
            ? 'Sincroniza el inventario para cargar los productos.'
            : 'Agrega el primer producto para comenzar a operar.'}
      </p>
      {!hasProducts && configured && canSync && (
        <button type="button" onClick={onSync} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          <RefreshCw className="h-4 w-4" />
          Sincronizar inventario
        </button>
      )}
    </div>
  )
}
