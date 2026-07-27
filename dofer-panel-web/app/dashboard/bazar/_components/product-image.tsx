'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { apiFetchBlob } from '@/lib/api'
import type { BazarProduct } from '../_lib/types'

// Las fotos subidas se sirven por su propio endpoint en vez de viajar dentro
// del catálogo. Se guardan por producto y versión para no volver a pedirlas al
// re-renderizar; el navegador además las conserva entre sesiones por su ETag.
const loaded = new Map<string, string>()

function imageKey(product: BazarProduct) {
  return product.has_image ? `${product.id}:${product.image_version || ''}` : ''
}

export function ProductImage({
  product,
  className = 'h-full w-full object-cover',
  fallbackClassName = 'm-4 h-6 w-6 text-muted-foreground',
}: {
  product: BazarProduct
  className?: string
  fallbackClassName?: string
}) {
  const key = imageKey(product)
  const [fetched, setFetched] = useState<{ key: string; url: string } | null>(null)

  useEffect(() => {
    if (product.image_url || !key || loaded.has(key)) return

    let cancelled = false
    void apiFetchBlob(`/bazar/products/${product.id}/image`)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        loaded.set(key, url)
        if (!cancelled) setFetched({ key, url })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [key, product.id, product.image_url])

  const source =
    product.image_url ||
    (key ? loaded.get(key) : '') ||
    (fetched?.key === key ? fetched.url : '')

  if (!source) return <ImageOff className={fallbackClassName} />
  // La fuente puede ser una URL del inventario o un blob local ya descargado.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt="" loading="lazy" className={className} />
}
