import { TS } from "@/i18n/TS"
import Image from "@/lib/imagenes/Imagen"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listOffers } from "@/lib/data/offers"
import { umbralesDeEnvioGratis } from "@/lib/envios/envio-gratis"
import { primerEscalon, type Escalon } from "@/lib/helpers/volumen"
import { compareOffers, getOfferAmount, getOfferStock, StoreOffer } from "@/lib/helpers/buybox"
import { convertToLocale } from "@/lib/helpers/money"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { formatosDe } from "@/lib/hetna/formatos"
import { licenciaDe } from "@/lib/hetna/licencias"
import { esFichaDescarga, tipoFicha } from "@/lib/hetna/tipo-ficha"
import { origenDe } from "@/lib/hetna/origen"

import { BotonAgregarRapido } from "./BotonAgregarRapido"
import { DistintivoEnvioGratis } from "./envios/DistintivoEnvioGratis"
import { DistintivoVolumen } from "./precios/EscalonesVolumen"
import { Estrellas } from "./resenas/Estrellas"

// Lo que la lista ya sabe de cada producto: quién lo vende y cuál es su mejor
// oferta. La consulta de ofertas ya se hacía para poner "Vendido por"; ahora
// además se guarda el id de la oferta ganadora, su precio y su inventario, y
// con eso la tarjeta puede agregar al carrito sin pedir nada más.
//
// El umbral de envío gratis del taller se resuelve aquí mismo, en una sola
// llamada para la lista entera, para que los listados que usan esto no tengan
// que enterarse: les sigue llegando un Vendedor y ya.
export type Calificacion = { promedio: number; total: number }

export type Vendedor = {
  nombre: string
  handle?: string
  total: number
  sellerId?: string
  ofertaId?: string
  precio?: number | null
  precioLista?: number | null
  moneda?: string
  existencias?: number
  // Monto del carrito a partir del cual este taller manda gratis, si lo tiene
  // puesto en su pantalla de Envíos.
  envioGratisDesde?: number | null
  // El primer escalón de precio por cantidad de la oferta ganadora, si tiene.
  escalon?: Escalon | null
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
      const handle = (oferta.seller as { handle?: string } | undefined)?.handle
      if (!id || !nombre) continue
      const sellerId = oferta.seller?.id

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
        handle: previo ? previo.handle : handle,
        total: previo ? previo.total + 1 : 1,
        // El taller que se nombra y el umbral que se enseña son los de la
        // oferta ganadora, no los del primero que llegó.
        sellerId: campeona.seller?.id ?? sellerId,
        escalon: primerEscalon(campeona),
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

  const umbrales = await umbralesDeEnvioGratis(
    [...mapa.values()].map((v) => v.sellerId).filter((x): x is string => !!x)
  )
  for (const vendedor of mapa.values()) {
    const umbral = vendedor.sellerId ? umbrales[vendedor.sellerId] : undefined
    vendedor.envioGratisDesde = umbral ? umbral.gratis_desde : null
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
  calificacion,
  locale = "mx",
}: {
  product: HttpTypes.StoreProduct
  vendedor?: Vendedor
  calificacion?: Calificacion
  locale?: string
}) {
  const moneda = vendedor?.moneda || "mxn"
  // Los archivos gratis no llevan oferta ni carrito: se bajan desde la ficha.
  const esGratis = (product.metadata as Record<string, unknown> | null)?.archivo_gratis === true
  const precioOferta = esGratis ? null : (vendedor?.precio ?? null)
  const precio = esGratis
    ? "Gratis"
    : precioOferta !== null
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

  // Diseño para descargar: qué formato trae y con qué licencia, a la vista
  const descarga = esFichaDescarga(product)
  const fmts = descarga ? formatosDe(product) : []
  const licencia = descarga ? licenciaDe(product.metadata as Record<string, unknown> | null).licencia.nombre : null

  const creado = product.created_at ? new Date(product.created_at).getTime() : 0
  const esNuevo = creado > 0 && Date.now() - creado < 30 * DIA
  // Quién lo vende y qué es (auditoría 19 nov, punto 4): tienda propia,
  // taller de la plataforma o varios; y si es producto, descarga o servicio.
  const origen = vendedor && vendedor.total === 1 ? origenDe({ handle: vendedor.handle, name: vendedor.nombre }) : null
  const m = (product.metadata || {}) as Record<string, unknown>
  const esCreditos = m.producto_creditos_3d === true || m.producto_creditos_3d === "true"
  const tipo = esCreditos ? "creditos" : descarga ? "descarga" : tipoFicha(product as never) === "servicio" ? "servicio" : "fisico"
  const ETIQUETA_TIPO = {
    descarga: { texto: "⬇ Descarga", clase: "bg-[#1E2329] text-white" },
    servicio: { texto: "Servicio", clase: "bg-[#E8F5EC] text-[#17603A] ring-1 ring-[#B9DFC6]" },
    creditos: { texto: "Créditos", clase: "bg-[#EAF1FB] text-[#1F4E8C] ring-1 ring-[#C3D6F0]" },
    fisico: { texto: "Producto", clase: "bg-[#F4F1EA] text-[#44433D] ring-1 ring-[#E0DCD2]" },
  }[tipo]

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
                <TS>Nuevo</TS>
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
              <TS>Agotado</TS>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-3">
          {/* Qué es y quién lo vende, de un vistazo */}
          <span className="flex flex-wrap items-center gap-1 text-[10.5px] font-bold">
            <span className={`rounded px-1.5 py-0.5 ${ETIQUETA_TIPO.clase}`}><TS>{ETIQUETA_TIPO.texto}</TS></span>
            {vendedor &&
              (vendedor.total > 1 ? (
                <span className="rounded px-1.5 py-0.5 text-[#44433D] ring-1 ring-[#E0DCD2]"><TS>Varios talleres</TS></span>
              ) : origen === "hetna" ? (
                <span className="rounded bg-[#C2560A] px-1.5 py-0.5 text-white"><TS>HETNA oficial</TS></span>
              ) : (
                <span className="max-w-[120px] truncate rounded px-1.5 py-0.5 text-[#1F4E8C] ring-1 ring-[#C3D6F0]" title={vendedor.nombre}>
                  <TS>Taller ·</TS> {vendedor.nombre}
                </span>
              ))}
          </span>
          <span className="min-h-[34px] text-[13px] leading-[1.3] text-[#1B1B18] line-clamp-2">
            {product.title}
          </span>

          {descarga && (
            <span className="flex flex-wrap items-center gap-1 text-[10.5px] font-semibold">
              {fmts.slice(0, 3).map((f) => (
                <span key={f} className="rounded border border-[#D4D9DF] px-1.5 py-0.5 text-[#1E2329]">
                  {f}
                </span>
              ))}
              {licencia && <span className="text-[#6B6A63]"><TS>Lic.</TS> {licencia}</span>}
            </span>
          )}

          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[17px] font-extrabold text-[#142033]">{precio}</span>
            {hayDescuento && (
              <span className="text-[12px] text-[#8A8780] line-through">
                {convertToLocale({ amount: lista as number, currency_code: moneda })}
              </span>
            )}
          </span>

          {calificacion && (
            <span className="flex items-center gap-1 text-[11.5px] text-[#6B6A63]">
              <Estrellas valor={calificacion.promedio} size={12} />
              <span className="font-semibold text-[#1B1B18]">
                {calificacion.promedio.toFixed(1)}
              </span>
              <span>({calificacion.total})</span>
            </span>
          )}

          {pocas && (
            <span className="text-[11.5px] font-bold text-[#9B3225]">
              {existencias === 1 ? "Queda 1" : `Quedan ${existencias}`}
            </span>
          )}

          <DistintivoVolumen escalon={vendedor?.escalon} compacto />

          <DistintivoEnvioGratis
            desde={vendedor?.envioGratisDesde}
            currency_code={moneda}
            compacto
          />
        </div>
      </LocalizedClientLink>

      {/* El atajo va FUERA del enlace: un <button> dentro de un <a> no es HTML
          válido y el clic se iría a la ficha. Se coloca sobre la esquina de la
          foto, a la altura que mide el recuadro de la imagen. */}
      {/* Sin atajo en lo que se pide con texto (llaveros, letras): el texto se escribe en la ficha */}
      {vendedor?.ofertaId && precioOferta !== null && !agotado && !(product.metadata as Record<string, unknown> | null)?.personalizable && (
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
