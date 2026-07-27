import {
  MAX_SALE_QUANTITY,
} from './constants'
import type {
  BazarProduct,
  ProductGroup,
} from './types'

export function productTracksStock(product: BazarProduct) {
  return product.track_stock !== false
}

export function productSaleLimit(product: BazarProduct) {
  return productTracksStock(product) ? product.stock : MAX_SALE_QUANTITY
}

export function productGroupID(product: BazarProduct) {
  return product.variant_group_id || product.id
}

export function variantLabel(product: BazarProduct) {
  return product.variant_name?.trim() || 'Única'
}

export function productDisplayName(product: BazarProduct) {
  return product.variant_name?.trim()
    ? `${product.name} · ${product.variant_name.trim()}`
    : product.name
}

export function groupCatalogProducts(products: BazarProduct[]) {
  const groups = new Map<string, ProductGroup>()
  for (const product of products) {
    const id = productGroupID(product)
    const current = groups.get(id)
    if (current) {
      current.variants.push(product)
    } else {
      groups.set(id, {
        id,
        name: product.name,
        category: product.category,
        variants: [product],
      })
    }
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    variants: group.variants.sort((first, second) => {
      const availability =
        Number(second.active && productSaleLimit(second) > 0) -
        Number(first.active && productSaleLimit(first) > 0)
      if (availability !== 0) return availability
      return variantLabel(first).localeCompare(variantLabel(second), 'es')
    }),
  }))
}

export function normalizeProductLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
}
