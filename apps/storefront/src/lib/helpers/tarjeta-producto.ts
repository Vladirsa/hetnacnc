import type { HttpTypes } from "@medusajs/types"

/**
 * Sólo lo que pinta la tarjeta del listado (foto, nombre, liga y precio). El listado inicial
 * viaja dentro del HTML: con el producto completo eran ~70 KB antes de la primera tarjeta.
 */
export function paraTarjeta(p: HttpTypes.StoreProduct): HttpTypes.StoreProduct {
  const gratis = (p.metadata as Record<string, unknown> | null | undefined)?.archivo_gratis
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    thumbnail: p.thumbnail,
    metadata: gratis === undefined ? null : { archivo_gratis: gratis },
    variants: (p.variants || []).map((v) => ({ id: v.id, sku: v.sku, calculated_price: v.calculated_price })),
  } as HttpTypes.StoreProduct
}
