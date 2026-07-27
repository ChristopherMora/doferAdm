'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CloudOff,
  ImageOff,
  LoaderCircle,
  Mail,
  MessageCircle,
  Minus,
  PackageCheck,
  Pause,
  Plus,
  Printer,
  ReceiptText,
  Repeat2,
  ScanLine,
  Search,
  Star,
  Trash2,
  Undo2,
  Wifi,
  X,
} from 'lucide-react'
import {
  type StoredCombo,
  type StoredHeldSale,
  readLastVariants,
  writeLastVariant,
} from '../_lib/pos-storage'
import {
  DialogBackdrop,
  DialogHeader,
} from './dialog'
import {
  InlineScanner,
} from './scanner'
import {
  MAX_SALE_QUANTITY,
  PAYMENT_METHODS,
} from '../_lib/constants'
import {
  localDateKey,
  moneyFormatter,
  paymentLabel,
  timeFormatter,
} from '../_lib/format'
import {
  groupCatalogProducts,
  normalizeProductLookup,
  productDisplayName,
  productGroupID,
  productSaleLimit,
  productTracksStock,
  variantLabel,
} from '../_lib/products'
import {
  printReceipt,
  receiptText,
} from '../_lib/reports'
import type {
  BazarProduct,
  PaymentMethod,
  PosCheckoutInput,
  Sale,
} from '../_lib/types'

export function QuickSaleDialog({
  bazarName,
  products,
  initialItems,
  favoriteProducts,
  saleCounts,
  combos,
  heldSales,
  defaultPaymentMethod,
  onClose,
  onCreateProduct,
  onFavorite,
  onSaveCombo,
  onDeleteCombo,
  onHoldSale,
  onDeleteHeldSale,
  onSubmit,
}: {
  bazarName: string
  products: BazarProduct[]
  initialItems: Record<string, number>
  favoriteProducts: Set<string>
  saleCounts: Record<string, number>
  combos: StoredCombo[]
  heldSales: StoredHeldSale[]
  defaultPaymentMethod: PaymentMethod
  onClose: () => void
  onCreateProduct: (input: { name: string; category: string; price: number }) => Promise<BazarProduct | null>
  onFavorite: (productID: string) => void
  onSaveCombo: (name: string, items: Record<string, number>) => void
  onDeleteCombo: (comboID: string) => void
  onHoldSale: (items: Record<string, number>, paymentMethod: PaymentMethod) => void
  onDeleteHeldSale: (saleID: string) => void
  onSubmit: (input: PosCheckoutInput) => boolean
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [selectedProductID, setSelectedProductID] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod)
  const [draftCart, setDraftCart] = useState<Record<string, number>>(initialItems)
  const [cashReceived, setCashReceived] = useState('')
  const [showChangeCalculator, setShowChangeCalculator] = useState(false)
  const [saleDate, setSaleDate] = useState(() => localDateKey())
  const [tab, setTab] = useState<'sale' | 'combos' | 'held'>('sale')
  const [comboName, setComboName] = useState('')
  const [showInlineScanner, setShowInlineScanner] = useState(false)
  const [addingProduct, setAddingProduct] = useState(false)
  const [saleRegistered, setSaleRegistered] = useState(false)
  const [lastVariants, setLastVariants] = useState<Record<string, string>>({})

  const normalizedSearch = normalizeProductLookup(search)
  const selectedProduct =
    products.find((product) => product.id === selectedProductID) || null
  const exactCodeProduct =
    !selectedProduct && normalizedSearch
      ? products.find(
          (product) =>
            normalizeProductLookup(product.external_id) === normalizedSearch,
        ) || null
      : null
  const exactNameProducts =
    !selectedProduct && !exactCodeProduct && normalizedSearch
      ? products.filter(
          (product) => normalizeProductLookup(product.name) === normalizedSearch,
        )
      : []
  const exactProduct =
    selectedProduct ||
    exactCodeProduct ||
    (exactNameProducts.length === 1 ? exactNameProducts[0] : null)
  const resolvedProduct = selectedProduct || exactProduct

  const matchingProducts = useMemo(() => {
    const candidates = products.filter((product) => {
      if (!product.active) return false
      if (!normalizedSearch) return true
      return (
        normalizeProductLookup(product.name).includes(normalizedSearch) ||
        normalizeProductLookup(product.external_id).includes(normalizedSearch) ||
        normalizeProductLookup(product.category).includes(normalizedSearch) ||
        normalizeProductLookup(product.variant_name || '').includes(normalizedSearch)
      )
    })
    // A igualdad de coincidencia manda lo que más se ha vendido hoy: con el
    // buscador vacío la lista arranca con lo que realmente se está moviendo.
    const soldToday = (product: BazarProduct) => saleCounts[product.id] || 0
    return candidates.sort((first, second) => {
      const rank = (product: BazarProduct) => {
        const name = normalizeProductLookup(product.name)
        const code = normalizeProductLookup(product.external_id)
        if (!normalizedSearch) return 0
        if (name === normalizedSearch || code === normalizedSearch) return 0
        if (name.startsWith(normalizedSearch)) return 1
        if (code.startsWith(normalizedSearch)) return 2
        return 3
      }
      const byRank = rank(first) - rank(second)
      if (byRank !== 0) return byRank
      return soldToday(second) - soldToday(first)
    })
  }, [normalizedSearch, products, saleCounts])
  const matchingGroups = useMemo(
    () =>
      groupCatalogProducts(matchingProducts)
        .map((group) => ({
          ...group,
          variants: [...group.variants].sort((first, second) => {
            const rank = (product: BazarProduct) =>
              product.id === lastVariants[group.id]
                ? 0
                : favoriteProducts.has(product.id)
                  ? 1
                  : 2
            const byRank = rank(first) - rank(second)
            if (byRank !== 0) return byRank
            return (saleCounts[second.id] || 0) - (saleCounts[first.id] || 0)
          }),
        }))
        .slice(0, 6),
    [favoriteProducts, lastVariants, matchingProducts, saleCounts],
  )

  const newProductName = search.trim()
  const isNewProduct =
    !resolvedProduct &&
    newProductName.length > 0 &&
    (createNew || matchingGroups.length === 0)
  const quantityLimit = resolvedProduct
    ? productSaleLimit(resolvedProduct)
    : MAX_SALE_QUANTITY
  const unitPrice = resolvedProduct?.price ?? Number(price || 0)
  const unavailable =
    resolvedProduct !== null &&
    (!resolvedProduct.active ||
      (productTracksStock(resolvedProduct) && resolvedProduct.stock === 0))
  const validNewProduct =
    isNewProduct &&
    price.trim() !== '' &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0
  const canAdd =
    !addingProduct &&
    !unavailable &&
    quantity >= 1 &&
    quantity <= quantityLimit &&
    (resolvedProduct !== null || validNewProduct)

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => (draftCart[product.id] || 0) > 0)
        .map((product) => ({
          product,
          quantity: draftCart[product.id],
        })),
    [draftCart, products],
  )
  const cartUnits = cartItems.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cartItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  )
  // El efectivo recibido es opcional: solo se manda cuando el vendedor abre
  // la calculadora de cambio y captura un monto que alcanza el total.
  const parsedCashReceived = Number(cashReceived)
  const reportedCash =
    paymentMethod === 'cash' &&
    cashReceived !== '' &&
    Number.isFinite(parsedCashReceived) &&
    parsedCashReceived >= cartTotal
      ? parsedCashReceived
      : undefined
  const canCheckout = cartItems.length > 0
  const today = localDateKey()
  const backdated = saleDate !== today

  const resetSelection = () => {
    setSelectedProductID('')
    setCreateNew(false)
    setSearch('')
    setPrice('')
    setCategory('')
    setQuantity(1)
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const addToDraft = (product: BazarProduct, amount: number) => {
    if (!product.active || (productTracksStock(product) && product.stock === 0)) return
    const groupID = productGroupID(product)
    setLastVariants((current) => ({ ...current, [groupID]: product.id }))
    writeLastVariant(groupID, product.id)
    setDraftCart((current) => ({
      ...current,
      [product.id]: Math.min(
        productSaleLimit(product),
        (current[product.id] || 0) + amount,
      ),
    }))
    resetSelection()
  }

  const updateDraftQuantity = (product: BazarProduct, nextQuantity: number) => {
    setDraftCart((current) => {
      const next = { ...current }
      if (nextQuantity <= 0) delete next[product.id]
      else next[product.id] = Math.min(productSaleLimit(product), nextQuantity)
      return next
    })
  }

  const handleAddProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canAdd) return
    let product = resolvedProduct
    if (!product) {
      setAddingProduct(true)
      try {
        product = await onCreateProduct({
          name: newProductName,
          category,
          price: unitPrice,
        })
      } finally {
        setAddingProduct(false)
      }
    }
    if (product) addToDraft(product, quantity)
  }

  const checkout = (keepOpen: boolean) => {
    if (!canCheckout) return
    const completed = onSubmit({
      items: cartItems,
      paymentMethod,
      cashReceived: reportedCash,
      saleDate,
      keepOpen,
    })
    if (completed && keepOpen) {
      setDraftCart({})
      setCashReceived('')
      setShowChangeCalculator(false)
      setTab('sale')
      setSaleRegistered(true)
      window.setTimeout(() => setSaleRegistered(false), 1800)
      resetSelection()
    }
  }

  const addStoredItems = (items: Array<{ product_id: string; quantity: number }>) => {
    setDraftCart((current) => {
      const next = { ...current }
      for (const item of items) {
        const product = products.find((candidate) => candidate.id === item.product_id)
        if (!product || !product.active) continue
        next[product.id] = Math.min(
          productSaleLimit(product),
          (next[product.id] || 0) + item.quantity,
        )
      }
      return next
    })
    setTab('sale')
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  useEffect(() => {
    setLastVariants(readLastVariants())
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === '1') {
        event.preventDefault()
        setPaymentMethod('cash')
      } else if (event.altKey && event.key === '2') {
        event.preventDefault()
        setPaymentMethod('transfer')
      } else if (event.altKey && event.key === '3') {
        event.preventDefault()
        setPaymentMethod('card')
      } else if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        checkout(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <DialogBackdrop onClose={onClose}>
      <form
        onSubmit={handleAddProduct}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader eyebrow={bazarName} title="Nueva venta" onClose={onClose} />
        <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
          {([
            ['sale', `Venta${cartUnits > 0 ? ` (${cartUnits})` : ''}`],
            ['combos', `Combos${combos.length > 0 ? ` (${combos.length})` : ''}`],
            ['held', `Pendientes${heldSales.length > 0 ? ` (${heldSales.length})` : ''}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`h-9 rounded-md px-3 text-sm font-medium ${
                tab === value ? 'bg-foreground text-background' : 'hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 ${
            backdated
              ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
              : 'border-border'
          }`}
        >
          <label className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Día de la venta</span>
            <input
              type="date"
              value={saleDate}
              max={today}
              onChange={(event) => setSaleDate(event.target.value || today)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          {backdated && (
            <button
              type="button"
              onClick={() => setSaleDate(today)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-400 bg-background px-2.5 text-xs font-semibold text-amber-900 dark:text-amber-100"
            >
              Registrando en otro día · Volver a hoy
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'sale' && (
          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Producto</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setSelectedProductID('')
                    setCreateNew(false)
                    setQuantity(1)
                  }}
                  autoFocus
                  autoComplete="off"
                  placeholder="Nombre o código"
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || isNewProduct) return
                    const product =
                      resolvedProduct || matchingGroups[0]?.variants[0]
                    if (!product) return
                    event.preventDefault()
                    addToDraft(product, 1)
                  }}
                  className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-11 text-base"
                />
                {search && (
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="absolute right-1 top-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    title="Limpiar producto"
                    aria-label="Limpiar producto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!search && (
                  <button
                    type="button"
                    onClick={() => setShowInlineScanner(true)}
                    className="absolute right-1 top-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    title="Escanear código"
                    aria-label="Escanear código"
                  >
                    <ScanLine className="h-5 w-5" />
                  </button>
                )}
              </div>
            </label>

            {!resolvedProduct && !isNewProduct && (
              <div className="border-y border-border">
                <p className="py-2 text-xs font-medium uppercase text-muted-foreground">
                  {normalizedSearch ? 'Coincidencias' : 'Selección rápida'}
                </p>
                {matchingGroups.map((group) => {
                  const hasVariants =
                    group.variants.length > 1 ||
                    Boolean(group.variants[0]?.variant_group_id)
                  return (
                    <div key={group.id} className="border-t border-border py-3">
                      {hasVariants && (
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {group.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {group.category || 'Sin categoría'}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {group.variants.length} variantes
                          </span>
                        </div>
                      )}
                      <div className={`grid gap-2 ${hasVariants ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {group.variants.map((product) => {
                          const soldOut =
                            productTracksStock(product) && product.stock === 0
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addToDraft(product, 1)}
                              disabled={soldOut}
                              className="flex min-h-14 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                {product.variant_color ? (
                                  <span
                                    className="h-4 w-4 rounded-sm border border-black/15"
                                    style={{ backgroundColor: product.variant_color }}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <PackageCheck className="h-4 w-4 text-muted-foreground" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                  {hasVariants ? variantLabel(product) : product.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {moneyFormatter.format(product.price)}
                                  {' · '}
                                  {!productTracksStock(product)
                                    ? 'Libre'
                                    : soldOut
                                      ? 'Agotado'
                                      : `${product.stock} disp.`}
                                </span>
                              </span>
                              <Plus className="h-4 w-4 shrink-0 text-primary" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {matchingGroups.length === 0 && !normalizedSearch && (
                  <p className="border-t border-border py-4 text-sm text-muted-foreground">
                    Sin productos guardados.
                  </p>
                )}
                {normalizedSearch && (
                  <button
                    type="button"
                    onClick={() => setCreateNew(true)}
                    className="flex min-h-14 w-full items-center gap-3 border-t border-border py-2 text-left font-medium text-primary hover:bg-accent/60"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate">Crear “{newProductName}”</span>
                  </button>
                )}
              </div>
            )}

            {resolvedProduct && (
              <div className="flex items-center gap-3 border-y border-border py-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <PackageCheck className="h-5 w-5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {productDisplayName(resolvedProduct)}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {moneyFormatter.format(resolvedProduct.price)}
                    {' · '}
                    {!resolvedProduct.active
                      ? 'Inactivo'
                      : !productTracksStock(resolvedProduct)
                        ? 'Venta libre'
                        : `${resolvedProduct.stock} disponibles`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onFavorite(resolvedProduct.id)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
                  title={favoriteProducts.has(resolvedProduct.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  aria-label={favoriteProducts.has(resolvedProduct.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                  <Star className={`h-4 w-4 ${favoriteProducts.has(resolvedProduct.id) ? 'fill-current text-amber-500' : ''}`} />
                </button>
              </div>
            )}

            {resolvedProduct && !unavailable && (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 5].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => addToDraft(resolvedProduct, amount)}
                    disabled={amount > productSaleLimit(resolvedProduct)}
                    className="h-10 rounded-md border border-input bg-background text-sm font-semibold hover:bg-accent disabled:opacity-40"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            )}

            {isNewProduct && (
              <div className="space-y-4 border-y border-border py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Producto nuevo</p>
                    <p className="truncate font-semibold">{newProductName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetSelection}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
                    title="Cambiar producto"
                    aria-label="Cambiar producto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Precio</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        required
                        min="0"
                        max="999999999"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-11 w-full rounded-md border border-input bg-background pl-7 pr-3"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Categoría</span>
                    <input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      maxLength={100}
                      placeholder="Opcional"
                      className="h-11 w-full rounded-md border border-input bg-background px-3"
                    />
                  </label>
                </div>
              </div>
            )}

            {isNewProduct && (
              <div className="flex items-end gap-3">
                <div className="w-36">
                  <span className="mb-1.5 block text-sm font-medium">Cantidad</span>
                  <div className="grid h-11 grid-cols-[36px_1fr_36px] overflow-hidden rounded-md border border-input">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="inline-flex items-center justify-center hover:bg-accent disabled:opacity-40"
                      aria-label="Restar unidad"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={quantityLimit}
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          Math.min(
                            quantityLimit,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                      className="min-w-0 border-x border-input bg-background text-center font-semibold"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(quantityLimit, quantity + 1))}
                      disabled={quantity >= quantityLimit}
                      className="inline-flex items-center justify-center hover:bg-accent disabled:opacity-40"
                      aria-label="Agregar unidad"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!canAdd}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-foreground px-4 font-semibold text-background disabled:opacity-50"
                >
                  {addingProduct ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Agregar
                </button>
              </div>
            )}

            {unavailable && (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Producto no disponible para venta.
              </p>
            )}

            {cartItems.length > 0 && (
              <section className="border-y border-border">
                <div className="flex items-center justify-between py-2">
                  <h3 className="text-sm font-semibold">Productos</h3>
                  <span className="text-xs text-muted-foreground">{cartUnits} unidades</span>
                </div>
                {cartItems.map(({ product, quantity: itemQuantity }) => (
                  <div key={product.id} className="flex items-center gap-3 border-t border-border py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {productDisplayName(product)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {moneyFormatter.format(product.price * itemQuantity)}
                      </p>
                    </div>
                    <div className="grid h-9 w-32 grid-cols-[34px_1fr_34px] overflow-hidden rounded-md border border-input">
                      <button
                        type="button"
                        onClick={() => updateDraftQuantity(product, itemQuantity - 1)}
                        className="inline-flex items-center justify-center hover:bg-accent"
                        aria-label={`Restar ${productDisplayName(product)}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="inline-flex items-center justify-center border-x border-input text-sm font-semibold">
                        {itemQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateDraftQuantity(product, itemQuantity + 1)}
                        disabled={itemQuantity >= productSaleLimit(product)}
                        className="inline-flex items-center justify-center hover:bg-accent disabled:opacity-40"
                        aria-label={`Agregar ${productDisplayName(product)}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDraftQuantity(product, 0)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                      title="Quitar producto"
                      aria-label={`Quitar ${productDisplayName(product)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </section>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Método de pago</span>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as PaymentMethod)
                  setCashReceived('')
                  setShowChangeCalculator(false)
                }}
                className="h-11 w-full rounded-md border border-input bg-background px-3"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </label>

            {paymentMethod === 'cash' && cartItems.length > 0 && !showChangeCalculator && (
              <button
                type="button"
                onClick={() => setShowChangeCalculator(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                <Banknote className="h-4 w-4" />
                Calcular cambio (opcional)
              </button>
            )}

            {paymentMethod === 'cash' && cartItems.length > 0 && showChangeCalculator && (
              <section className="space-y-3">
                <label className="block">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Efectivo recibido</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCashReceived('')
                        setShowChangeCalculator(false)
                      }}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Omitir
                    </button>
                  </div>
                  <div className="relative">
                    <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(event) => setCashReceived(event.target.value)}
                      autoFocus
                      min={cartTotal}
                      max="999999999"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={moneyFormatter.format(cartTotal)}
                      className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-lg font-semibold"
                    />
                  </div>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[cartTotal, 50, 100, 200, 500].map((amount, index) => (
                    <button
                      key={`${amount}-${index}`}
                      type="button"
                      onClick={() => setCashReceived(String(amount))}
                      disabled={index > 0 && amount < cartTotal}
                      className="h-9 rounded-md border border-input bg-background text-xs font-semibold hover:bg-accent disabled:opacity-35"
                    >
                      {index === 0 ? 'Exacto' : `$${amount}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-y border-border py-2">
                  <span className="text-sm text-muted-foreground">Cambio</span>
                  <strong className="text-lg">
                    {reportedCash === undefined
                      ? '—'
                      : moneyFormatter.format(reportedCash - cartTotal)}
                  </strong>
                </div>
              </section>
            )}
          </div>
          )}

          {tab === 'combos' && (
            <div className="space-y-4 p-5">
              <div className="divide-y divide-border border-y border-border">
                {combos.map((combo) => (
                  <div key={combo.id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => addStoredItems(combo.items)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate font-semibold">{combo.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {combo.items.reduce((total, item) => total + item.quantity, 0)} unidades
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCombo(combo.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                      title="Eliminar combo"
                      aria-label={`Eliminar ${combo.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {combos.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin combos guardados.</p>
                )}
              </div>
              {cartItems.length > 0 && (
                <div className="flex gap-2">
                  <input
                    value={comboName}
                    onChange={(event) => setComboName(event.target.value)}
                    maxLength={80}
                    placeholder="Nombre del combo"
                    className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = comboName.trim()
                      if (!name) return
                      onSaveCombo(name, draftCart)
                      setComboName('')
                    }}
                    disabled={!comboName.trim()}
                    className="h-11 rounded-md bg-foreground px-4 font-semibold text-background disabled:opacity-40"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'held' && (
            <div className="divide-y divide-border p-5">
              {heldSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftCart(Object.fromEntries(sale.items.map((item) => [item.product_id, item.quantity])))
                      setPaymentMethod(sale.payment_method as PaymentMethod)
                      onDeleteHeldSale(sale.id)
                      setTab('sale')
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate font-semibold">{sale.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {sale.items.reduce((total, item) => total + item.quantity, 0)} unidades · {new Date(sale.created_at).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteHeldSale(sale.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                    title="Eliminar venta pendiente"
                    aria-label={`Eliminar ${sale.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {heldSales.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas pendientes.</p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-border bg-muted/45 px-5 py-4">
          {saleRegistered && (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Venta registrada. Lista para la siguiente.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
              <p className="truncate text-2xl font-semibold text-primary">
                {moneyFormatter.format(cartTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onHoldSale(draftCart, paymentMethod)
                setDraftCart({})
                setCashReceived('')
              }}
              disabled={cartItems.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium disabled:opacity-40"
            >
              <Pause className="h-4 w-4" />
              Pendiente
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => checkout(false)}
              disabled={!canCheckout}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-primary bg-background px-3 font-semibold text-primary disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Cobrar
            </button>
            <button
              type="button"
              onClick={() => checkout(true)}
              disabled={!canCheckout}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              <Repeat2 className="h-4 w-4" />
              Cobrar y siguiente
            </button>
          </div>
        </div>

        {showInlineScanner && (
          <InlineScanner
            onClose={() => setShowInlineScanner(false)}
            onDetected={(value) => {
              const normalizedValue = normalizeProductLookup(value)
              const product =
                products.find(
                  (candidate) =>
                    normalizeProductLookup(candidate.external_id) === normalizedValue,
                ) ||
                products.find(
                  (candidate) =>
                    normalizeProductLookup(candidate.name) === normalizedValue,
                )
              if (product) addToDraft(product, 1)
              else setSearch(value)
              setShowInlineScanner(false)
            }}
          />
        )}
      </form>
    </DialogBackdrop>
  )
}

export function QuantityDialog({
  product,
  quantity,
  paymentMethod,
  onQuantityChange,
  onPaymentChange,
  onClose,
  onConfirm,
}: {
  product: BazarProduct
  quantity: number
  paymentMethod: PaymentMethod
  onQuantityChange: (quantity: number) => void
  onPaymentChange: (method: PaymentMethod) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const quantityLimit = productSaleLimit(product)
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card text-card-foreground shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Venta de varias unidades</p>
            <h2 id="quantity-title" className="mt-1 text-xl font-semibold">
              {productDisplayName(product)}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent" title="Cerrar" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 px-5 py-6">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            title="Restar unidad"
            aria-label="Restar unidad"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            type="number"
            min={1}
            max={quantityLimit}
            value={quantity}
            onChange={(event) => onQuantityChange(Math.min(quantityLimit, Math.max(1, Number(event.target.value) || 1)))}
            className="h-14 w-24 rounded-md border border-input bg-background text-center text-2xl font-semibold"
            aria-label="Cantidad"
          />
          <button
            type="button"
            onClick={() => onQuantityChange(Math.min(quantityLimit, quantity + 1))}
            disabled={quantity >= quantityLimit}
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            title="Agregar unidad"
            aria-label="Agregar unidad"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <label className="mx-5 block">
          <span className="mb-2 block text-sm font-medium">Método de pago</span>
          <select
            value={paymentMethod}
            onChange={(event) => onPaymentChange(event.target.value as PaymentMethod)}
            className="h-11 w-full rounded-md border border-input bg-background px-3"
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>
        </label>

        <div className="mt-6 flex items-center justify-between border-t border-border bg-muted/45 px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold text-primary">{moneyFormatter.format(product.price * quantity)}</p>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Registrar venta
          </button>
        </div>
      </div>
    </div>
  )
}

export function CartDialog({
  items,
  units,
  total,
  paymentMethod,
  onPaymentChange,
  onQuantityChange,
  onClose,
  onConfirm,
}: {
  items: Array<{ product: BazarProduct; quantity: number }>
  units: number
  total: number
  paymentMethod: PaymentMethod
  onPaymentChange: (method: PaymentMethod) => void
  onQuantityChange: (product: BazarProduct, quantity: number) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={`${units} ${units === 1 ? 'unidad' : 'unidades'}`} title="Carrito de venta" onClose={onClose} />
        <div className="divide-y divide-border px-5">
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center gap-3 py-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="m-4 h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {productDisplayName(product)}
                </p>
                <p className="text-sm text-muted-foreground">{moneyFormatter.format(product.price * quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => onQuantityChange(product, quantity - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input" title="Restar">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <button type="button" onClick={() => onQuantityChange(product, quantity + 1)} disabled={quantity >= productSaleLimit(product)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input disabled:opacity-40" title="Sumar">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onQuantityChange(product, 0)} className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Quitar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">El carrito está vacío.</p>}
        </div>
        <div className="space-y-4 border-t border-border bg-muted/35 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Método de pago</span>
            <select value={paymentMethod} onChange={(event) => onPaymentChange(event.target.value as PaymentMethod)} className="h-11 w-full rounded-md border border-input bg-background px-3">
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onConfirm} disabled={items.length === 0} className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" />
              Cobrar
            </span>
            <span>{moneyFormatter.format(total)}</span>
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}

export function RepeatSaleDialog({
  sale,
  products,
  onClose,
  onConfirm,
}: {
  sale: Sale
  products: BazarProduct[]
  onClose: () => void
  onConfirm: () => void
}) {
  const hasUnavailableItems = sale.items.some((item) => {
    const product = products.find((candidate) => candidate.id === item.product_id)
    return (
      !product?.active ||
      (productTracksStock(product) && product.stock < item.quantity)
    )
  })

  return (
    <DialogBackdrop onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg"
      >
        <DialogHeader
          eyebrow={`Venta ${sale.external_id}`}
          title="Preparar venta anterior"
          onClose={onClose}
        />
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Cargará los mismos productos y cantidades en Nueva venta. Podrás revisarlos,
            cambiar el método de pago y decidir cuándo cobrar.
          </p>
          <div className="divide-y divide-border border-y border-border">
            {sale.items.map((item) => (
              <div key={item.product_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {moneyFormatter.format(item.unit_price)}
                  </p>
                </div>
                <strong className="shrink-0 text-sm">{moneyFormatter.format(item.total)}</strong>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Pago anterior: {paymentLabel(sale.payment_method)}
            </span>
            <strong>{moneyFormatter.format(sale.total)}</strong>
          </div>
          {hasUnavailableItems && (
            <div className="flex gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Alguna cantidad se ajustará al stock disponible.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border bg-muted/45 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-input bg-background px-4 font-medium hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground"
          >
            <Repeat2 className="h-4 w-4" />
            Preparar venta
          </button>
        </div>
      </div>
    </DialogBackdrop>
  )
}

export function SyncDot({ status }: { status: Sale['sync_status'] }) {
  if (status === 'synced') {
    return <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Wifi className="h-3.5 w-3.5" /> Sincronizada</span>
  }
  if (status === 'error') {
    return <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><CloudOff className="h-3.5 w-3.5" /> Error</span>
  }
  return <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock3 className="h-3.5 w-3.5" /> Pendiente</span>
}

export function RecentSale({
  sale,
  onUndo,
  onReceipt,
  canUndo,
}: {
  sale: Sale
  onUndo: () => void
  onReceipt: () => void
  canUndo: boolean
}) {
  const itemSummary = sale.items
    .map((item) => `${item.quantity} ${item.product_name}`)
    .join(', ')
  return (
    <article className={`rounded-md border p-3 ${
      sale.status === 'cancelled' ? 'border-border bg-muted/50 opacity-70' : 'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {timeFormatter.format(new Date(sale.sold_at))}
            <SyncDot status={sale.sync_status} />
          </div>
          <p className={`mt-1 line-clamp-2 text-sm font-medium ${sale.status === 'cancelled' ? 'line-through' : ''}`}>
            {itemSummary}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {paymentLabel(sale.payment_method)} · {sale.seller_name}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <p className="font-semibold">{moneyFormatter.format(sale.total)}</p>
          {sale.status === 'cancelled' ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Cancelada</span>
          ) : canUndo ? (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Undo2 className="h-3.5 w-3.5" />
              Deshacer
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReceipt}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Ticket
          </button>
        </div>
      </div>
    </article>
  )
}

export function SaleConfirmation({
  sale,
  onClose,
  onUndo,
  onReceipt,
}: {
  sale: Sale
  onClose: () => void
  onUndo: () => void
  onReceipt: () => void
}) {
  const units = sale.items.reduce((total, item) => total + item.quantity, 0)
  // Deja claro a qué día se fue la venta cuando no es la jornada de hoy.
  const soldOn = sale.sold_at.slice(0, 10)
  const backdated = soldOn !== localDateKey()
  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-lg rounded-md border border-emerald-300 bg-emerald-950 p-4 text-white shadow-xl">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {backdated ? `Venta registrada el ${soldOn}` : 'Venta registrada'}
              </p>
              <p className="mt-0.5 truncate text-sm text-emerald-100">
                {units} {units === 1 ? 'producto' : 'productos'} · {moneyFormatter.format(sale.total)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-emerald-100 hover:text-white" title="Cerrar" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SyncDot status={sale.sync_status} />
            <div className="flex items-center gap-2">
              <button type="button" onClick={onReceipt} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-sm font-medium hover:bg-emerald-900">
                <ReceiptText className="h-4 w-4" />
                Ticket
              </button>
              <button type="button" onClick={onUndo} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500 px-3 text-sm font-medium hover:bg-emerald-900">
                <Undo2 className="h-4 w-4" />
                Deshacer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReceiptDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const text = receiptText(sale)
  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow={sale.external_id} title="Comprobante de venta" onClose={onClose} />
        <div className="p-5">
          <pre className="whitespace-pre-wrap border-y border-dashed border-border py-5 font-sans text-sm leading-6">{text}</pre>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/35 p-4">
          <button type="button" onClick={() => printReceipt(sale)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent" title="Imprimir">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent" title="Enviar por WhatsApp">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`Comprobante ${sale.external_id}`)}&body=${encodeURIComponent(text)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground" title="Enviar por correo">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Correo</span>
          </a>
        </div>
      </div>
    </DialogBackdrop>
  )
}
