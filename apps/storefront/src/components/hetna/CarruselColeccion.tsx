import Image from "next/image"
import TarjetaProducto, { vendedoresPorProducto } from "./TarjetaProducto"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listCollections } from "@/lib/data/collections"
import { listProducts } from "@/lib/data/products"
import { getProductPrice } from "@/lib/helpers/get-product-price"

const CARD =
  "snap-start shrink-0 w-[160px] sm:w-[180px] bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg"

const Tarjeta = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const precio = getProductPrice({ product }).cheapestPrice?.calculated_price
  let foto: string | null = null
  try {
    foto = product.thumbnail ? decodeURIComponent(product.thumbnail) : null
  } catch {
    foto = product.thumbnail || null
  }
  return (
    <LocalizedClientLink href={"/products/" + product.handle} className={CARD}>
      <div className="relative h-[130px] sm:h-[145px] bg-[#F4F1EA]">
        <Image
          src={foto || "/images/placeholder.svg"}
          alt={product.title || "Producto"}
          fill
          sizes="180px"
          loading="lazy"
          unoptimized={!foto}
          className="object-contain p-2"
        />
      </div>
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[13px] leading-[1.3] text-[#1B1B18] line-clamp-2 min-h-[34px]">
          {product.title}
        </span>
        <span className="text-[15px] font-bold text-[#142033]">{precio}</span>
      </div>
    </LocalizedClientLink>
  )
}

type Props = {
  locale: string
  handle: string
  titulo: string
  subtitulo?: string
  fondo?: boolean
}

export default async function CarruselColeccion(props: Props) {
  const { locale, handle, titulo, subtitulo, fondo = false } = props
  const cols = await listCollections().catch(() => ({
    collections: [] as HttpTypes.StoreCollection[],
    count: 0,
  }))
  const col = cols.collections.find((c) => c.handle === handle)
  if (!col) return null

  let productos: HttpTypes.StoreProduct[] = []
  try {
    const { response } = await listProducts({
      countryCode: locale,
      collection_id: col.id,
      queryParams: { limit: 12, order: "-created_at" },
    })
    productos = response.products
  } catch {
    productos = []
  }
  if (!productos.length) return null

  const mapa = await vendedoresPorProducto(locale)

  const fondoClase = fondo ? "bg-[#FAF6EF]" : ""
  return (
    <section className={"px-4 lg:px-16 py-8 md:py-10 " + fondoClase}>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[24px] md:text-[32px] font-extrabold leading-tight text-[#142033]">
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-1 text-[14px] md:text-[15px] text-[#6B6A63]">{subtitulo}</p>
            )}
          </div>
          <LocalizedClientLink
            href={"/collections/" + handle}
            className="shrink-0 text-[13.5px] font-bold text-[#B34D07] hover:underline"
          >
            Ver todo →
          </LocalizedClientLink>
        </div>
        <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory pb-3">
          {productos.map((p) => (
            <TarjetaProducto key={p.id} product={p} vendedor={mapa.get(p.id)} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  )
}
