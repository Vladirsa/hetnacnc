import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listOffers } from "@/lib/data/offers"
import { compareOffers, getOfferAmount, getOfferStock, StoreOffer } from "@/lib/helpers/buybox"
import { convertToLocale } from "@/lib/helpers/money"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { HttpTypes } from "@medusajs/types"

import { BotonAgregarRapido } from "./BotonAgregarRapido"

// Lo que la lista ya sabe de cada producto: quién lo vende y cuál es su mejor
// oferta. La consulta de ofertas ya se hacía para poner "Vendido por"; ahora
// además se guarda el id de la oferta ganadora, su precio y su inventario, y
// con eso la tarjeta puede agregar al carrito sin pedir nada más.
export type Vendedor = {
  nombre: string
  total: number
  ofertaId?: string
  precio?: number | null
  precioLista?: number | null
  moneda?: string
  existencias?: number
}

export const vendedoresPorProducto = async (
  locale: string
): Promise<Map<string, Vendedor>> => {
  const mapa = new Map<string, Vendedor>()
  const mejorOferta = new Map<string, StoreOffer>()

  try {
    const { offers } = await listOffers({ countryCode: locale, limit: 100 })

    for (const oferta of offers as StoreOffer[]) {
      const id =
        (oferta as { product_id?: string }).product_id ||
        (oferta as { product?: { id?: string } }).product?.id
      const nombre = oferta.seller?.name
      if (!id || !nombre) continue

      const previo = mapa.get(id)
      // La que gana el buybox es la que se enseña y la que se agrega: la misma
      // regla que usa la ficha del producto, para que el precio de la tarjeta
      // y el de adentro no se contradigan.
      const campeonaPrevia = mejorOferta.get(id)
      const campeona =
        !campeonaPrevia || compareOffers(oferta, campeonaPrevia) < 0 ? oferta : campeonaPrevia
      mejorOferta.set(id, campeona)

      const precios = campeona.calculated_price as
        | { calculated_amount?: number; original_amount?: number; currency_code?: string }
        | undefined

      mapa.set(id, {
        nombre: previo ? previo.nombre : nombre,
        total: previo ? previo.total + 1 : 1,
        ofertaId: campeona.id,
        precio: getOfferAmount(campeona),
        precioLista: precios?.original_amount ?? null,
        moneda: precios?.currency_code || "mxn",
        existencias: getOfferStock(campeona),
      })
    }
  } catch {
    return mapa
  }
  return mapa
}

const DIA = 86400000
// Debajo de esto vale la pena decirlo; arriba, el número no cambia la decisión.
const EXISTENCIAS_BAJAS = 10

const CARD =
  "group relative snap-start shrink-0 w-[170px] sm:w-[190px] bg-white border border-[#E7E4DC] rounded-[14px] overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:border-[#C2560A] hover:shadow-lg"

export default function TarjetaProducto({
  product,
  vendedor,
  locale = "mx",
}: {
  product: HttpTypes.StoreProduct
  vendedor?: Vendedor
  locale?: string
}) {
  const moneda = vendedor?.moneda || "mxn"
  const precioOferta = vendedor?.precio ?? null
  const precio =
    precioOferta !== null
      ? convertToLocale({ amount: precioOferta, currency_code: moneda })
      : getProductPrice({ product }).cheapestPrice?.calculated_price

  const lista = vendedor?.precioLista ?? null
  const hayDescuento = precioOferta !== null && lista !== null && lista > precioOferta
  const porcentaje = hayDescuento
    ? Math.round(((lista! - precioOferta!) / lista!) * 100)
    : 0

  const existencias = vendedor?.existencias
  const pocas =
    typeof existencias === "number" && existencias > 0 && existencias <= EXISTENCIAS_BAJAS
  const agotado = typeof existencias === "number" && existencias === 0

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
    <div className={CARD}>
      <LocalizedClientLink
        href={"/products/" + product.handle}
        className="flex flex-1 flex-col"
      >
        <div className="relative h-[140px] bg-[#F4F1EA] sm:h-[155px]">
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
            {esNuevo && (
              <span className="rounded-md bg-[#C2560A] px-2 py-0.5 text-[11px] font-bold text-white">
                Nuevo
              </span>
            )}
            {hayDescuento && porcentaje > 0 && (
              <span className="rounded-md bg-[#9B3225] px-2 py-0.5 text-[11px] font-bold text-white">
                −{porcentaje}%
              </span>
            )}
          </div>

          <Image
            src={foto || "/images/placeholder.svg"}
            alt={product.title || "Producto"}
            fill
            sizes="190px"
            loading="lazy"
            unoptimized={!foto}
            className="object-contain p-2"
          />

          {agotado && (
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] font-bold text-white">
              Agotado
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-3">
          {quien && (
            <span className="truncate text-[11.5px] font-medium text-[#6B6A63]">{quien}</span>
          )}
          <span className="min-h-[34px] text-[13px] leading-[1.3] text-[#1B1B18] line-clamp-2">
            {product.title}
          </span>

          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[17px] font-extrabold text-[#142033]">{precio}</span>
            {hayDescuento && (
              <span className="text-[12px] text-[#8A8780] line-through">
                {convertToLocale({ amount: lista as number, currency_code: moneda })}
              </span>
            )}
          </span>

          {pocas && (
            <span className="text-[11.5px] font-bold text-[#9B3225]">
              {existencias === 1 ? "Queda 1" : `Quedan ${existencias}`}
            </span>
          )}
        </div>
      </LocalizedClientLink>

      {/* El atajo va FUERA del enlace: un <button> dentro de un <a> no es HTML
          válido y el clic se iría a la ficha. Se coloca sobre la esquina de la
          foto, a la altura que mide el recuadro de la imagen. */}
      {vendedor?.ofertaId && precioOferta !== null && !agotado && (
        <div className="absolute right-2 top-[96px] z-20 sm:top-[111px]">
          <BotonAgregarRapido
            ofertaId={vendedor.ofertaId}
            productoId={product.id}
            titulo={product.title || "este producto"}
            precio={precioOferta}
            moneda={moneda}
            locale={locale}
          />
        </div>
      )}
    </div>
  )
}
