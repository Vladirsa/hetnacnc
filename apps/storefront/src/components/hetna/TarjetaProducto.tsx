import Image from "next/image"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listOffers } from "@/lib/data/offers"
import { getProductPrice } from "@/lib/helpers/get-product-price"

export type Vendedor = { nombre: string; total: number }

type OfertaLigera = {
  product_id?: string
  product?: { id?: string }
  seller?: { name?: string }
}

export const vendedoresPorProducto = async (
  locale: string
): Promise<Map<string, Vendedor>> => {
  const mapa = new Map<string, Vendedor>()
  try {
    const { offers } = await listOffers({ countryCode: locale, limit: 100 })
    for (const o of offers as unknown as OfertaLigera[]) {
      const id = o.product_id || o.product?.id
      const nombre = o.seller?.name
      if (!id || !nombre) continue
      const previo = mapa.get(id)
      mapa.set(id, {
        nombre: previo ? previo.nombre : nombre,
        total: previo ? previo.total + 1 : 1,
      })
    }
  } catch {
    return mapa
  }
  return mapa
}

const DIA = 86400000
const CARD =
  "snap-start shrink-0 w-[170px] sm:w-[190px] bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg"

export default function TarjetaProducto({
  product,
  vendedor,
}: {
  product: HttpTypes.StoreProduct
  vendedor?: Vendedor
}) {
  const precio = getProductPrice({ product }).cheapestPrice?.calculated_price
  let foto: string | null = null
  try {
    foto = product.thumbnail ? decodeURIComponent(product.thumbnail) : null
  } catch {
    foto = product.thumbnail || null
  }
  const creado = product.created_at ? new Date(product.created_at).getTime() : 0
  const esNuevo = creado > 0 && Date.now() - creado < 30 * DIA
  const quien = vendedor
    ? vendedor.total > 1
      ? "Varios talleres"
      : "Vendido por " + vendedor.nombre
    : null

  return (
    <LocalizedClientLink href={"/products/" + product.handle} className={CARD}>
      <div className="relative h-[140px] sm:h-[155px] bg-[#F4F1EA]">
        {esNuevo && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-[#C2560A] px-2 py-0.5 text-[11px] font-bold text-white">
            Nuevo
          </span>
        )}
        <Image
          src={foto || "/images/placeholder.svg"}
          alt={product.title || "Producto"}
          fill
          sizes="190px"
          loading="lazy"
          unoptimized={!foto}
          className="object-contain p-2"
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        {quien && (
          <span className="truncate text-[11.5px] font-medium text-[#6B6A63]">{quien}</span>
        )}
        <span className="min-h-[34px] text-[13px] leading-[1.3] text-[#1B1B18] line-clamp-2">
          {product.title}
        </span>
        <span className="mt-0.5 text-[17px] font-extrabold text-[#142033]">{precio}</span>
      </div>
    </LocalizedClientLink>
  )
}
