"use client"

// "Taller X te lo fabrica en $Y": las ofertas de los talleres en un producto de
// la Biblioteca de planos (lib/planos-ofertas.ts en el API). Sale en la ficha
// del producto y en la página del plano. El cliente elige el acabado y ve a
// todos los talleres que lo hacen, con su precio, sus días de entrega y si dan
// envío gratis, comparados con el precio recomendado por HETNA. Los talleres
// destacados (pagan $199 por 7 días) salen primero con su insignia.
//
// A la medida (página del plano con ?ancho=…): el precio de cada taller se
// ajusta en la misma proporción que cambia el costo de fabricarlo; es una
// referencia y el pedido va como solicitud al taller.
import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext } from "@/components/providers"
import { getOfferAmount, isPurchasable, type StoreOffer } from "@/lib/helpers/buybox"
import { toast } from "@/lib/helpers/toast"
import { TuUbicacion } from "@/components/hetna/ubicacion/TuUbicacion"
import { ETIQUETA_NIVEL, nivelCercania, type UbicacionTaller } from "@/lib/ubicacion/cercania"
import { useUbicacion } from "@/lib/ubicacion/useUbicacion"

export type VariantePlano = { id: string; titulo: string; recomendado: number | null }

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
const red = (n: number) => Math.round(n / 5) * 5

/** Taller destacado en planos (lo paga el taller: packages/api/src/lib/planos-destacado.ts). */
/** Ciudad, estado y CP del perfil público del taller que hace la oferta. */
const ubicacionDe = (o: StoreOffer): UbicacionTaller => {
  const p = ((o.seller as { metadata?: Record<string, any> | null } | undefined)?.metadata?.perfil || {}) as Record<string, unknown>
  const t = (v: unknown) => (typeof v === "string" ? v : undefined)
  return { ciudad: t(p.ciudad), estado: t(p.estado), cp: t(p.cp) }
}

export function esDestacado(o: StoreOffer, ahora = Date.now()): boolean {
  const hasta = ((o.seller as { metadata?: Record<string, any> | null } | undefined)?.metadata?.destacado_planos as { hasta?: string } | undefined)?.hasta
  const t = hasta ? Date.parse(hasta) : NaN
  return Number.isFinite(t) && t > ahora
}

export default function TalleresPlano({
  offers,
  variantes,
  locale,
  slug,
  factorMedida = 1,
  medidaTexto,
}: {
  offers: StoreOffer[]
  variantes: VariantePlano[]
  locale: string
  slug?: string
  /** costo a la medida ÷ costo original (1 = medida original) */
  factorMedida?: number
  medidaTexto?: string
}) {
  const { addToCart } = useCartContext()
  const conOferta = variantes.filter((v) => offers.some((o) => o.variant_id === v.id && getOfferAmount(o) !== null))
  const [elegida, setElegida] = useState<string>(conOferta[0]?.id || variantes[0]?.id || "")
  const [agregando, setAgregando] = useState<string | null>(null)
  const aMedida = Math.abs(factorMedida - 1) > 0.005
  const variante = variantes.find((v) => v.id === elegida)

  const { ubicacion, ponerCp, aviso } = useUbicacion()
  const lista = useMemo(
    () =>
      offers
        .filter((o) => o.variant_id === elegida && getOfferAmount(o) !== null)
        // destacados primero; luego el más cercano al cliente, el precio más bajo y menos días
        .sort(
          (a, b) =>
            Number(esDestacado(b)) - Number(esDestacado(a)) ||
            nivelCercania(ubicacionDe(a), ubicacion) - nivelCercania(ubicacionDe(b), ubicacion) ||
            getOfferAmount(a)! - getOfferAmount(b)! ||
            (a.leadtime_to_ship ?? 99) - (b.leadtime_to_ship ?? 99)
        ),
    [offers, elegida, ubicacion]
  )
  const hayUbicaciones = offers.some((o) => ubicacionDe(o).estado)

  async function agregar(o: StoreOffer) {
    setAgregando(o.id)
    try {
      await addToCart({ offerId: o.id, quantity: 1, countryCode: locale })
      toast.success({ title: "Agregado al carrito" })
    } catch (e) {
      toast.error({ title: (e as Error)?.message || "No se pudo agregar al carrito" })
    } finally {
      setAgregando(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5" aria-labelledby="talleres-plano">
      <h2 id="talleres-plano" className="m-0 text-[17px] font-bold text-[#142033]">
        Cómpralo hecho: talleres que te lo fabrican
      </h2>
      <p className="m-0 mt-1 text-[13px] text-[#6B6A63]">
        Kit de piezas cortadas en CNC, listo para armar.{aMedida && medidaTexto ? ` Precios aproximados a tu medida (${medidaTexto}).` : ""}
      </p>

      {conOferta.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Acabado">
            {conOferta.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === elegida}
                onClick={() => setElegida(v.id)}
                className={`min-h-[40px] rounded-full border px-3 text-[13px] font-semibold ${v.id === elegida ? "border-[#142033] bg-[#142033] text-white" : "border-[#D9D5C9] bg-white text-[#40403A]"}`}
              >
                {v.titulo}
              </button>
            ))}
          </div>
          {variante?.recomendado ? (
            <p className="m-0 mt-2 text-[12.5px] text-[#6B6A63]">
              Precio recomendado por HETNA: {pesos(red(variante.recomendado * factorMedida))}
            </p>
          ) : null}
          {hayUbicaciones && lista.length > 1 && (
            <div className="mt-2">
              <TuUbicacion ubicacion={ubicacion} ponerCp={ponerCp} aviso={aviso} />
            </div>
          )}
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {lista.map((o, i) => {
              const lugar = ubicacionDe(o)
              const cerca = ETIQUETA_NIVEL[nivelCercania(lugar, ubicacion)]
              const precio = red(getOfferAmount(o)! * factorMedida)
              const gratis = (o.metadata as Record<string, unknown> | null)?.envio_gratis === true
              const dias = o.leadtime_to_ship
              const destacado = esDestacado(o)
              const masBarato = getOfferAmount(o) === Math.min(...lista.map((x) => getOfferAmount(x)!))
              return (
                <li key={o.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${destacado || i === 0 ? "border-[#FF9F57] bg-[#FFF8F1]" : "border-[#EEECE6]"}`}>
                  <div className="min-w-[180px] flex-1">
                    <p className="m-0 text-[14.5px] text-[#142033]">
                      <b>{o.seller?.name || "Taller HETNA"}</b> te lo fabrica en <b>{pesos(precio)}</b>
                      {aMedida ? <span className="text-[12px] text-[#6B6A63]"> aprox.</span> : null}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                      {destacado ? <span className="rounded-full bg-[#FF6A1A] px-2 py-0.5 font-semibold text-white">★ Destacado</span> : null}
                      {lugar.estado ? (
                        <span className="rounded-full bg-[#F3F1EA] px-2 py-0.5 font-semibold text-[#40403A]">
                          📍 {[lugar.ciudad, lugar.estado].filter(Boolean).join(", ")}
                          {cerca ? ` · ${cerca}` : ""}
                        </span>
                      ) : null}
                      {gratis ? <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 font-semibold text-[#1E7B3A]">Envío gratis</span> : null}
                      {dias ? <span className="rounded-full bg-[#EEF1F6] px-2 py-0.5 font-semibold text-[#142033]">Lo tiene en {dias} {dias === 1 ? "día hábil" : "días hábiles"} + envío</span> : null}
                      {masBarato && lista.length > 1 ? <span className="rounded-full bg-[#FFE9D6] px-2 py-0.5 font-semibold text-[#B34D07]">Mejor precio</span> : null}
                    </div>
                  </div>
                  {aMedida ? (
                    <LocalizedClientLink href="/cotizar" className="inline-flex min-h-[44px] items-center rounded-[12px] border border-[#142033] px-4 text-[14px] font-bold text-[#142033]">
                      Pedir a tu medida
                    </LocalizedClientLink>
                  ) : (
                    <button
                      type="button"
                      disabled={!isPurchasable(o) || agregando === o.id}
                      onClick={() => agregar(o)}
                      className="inline-flex min-h-[44px] items-center rounded-[12px] bg-[#FF6A1A] px-4 text-[14px] font-bold text-white disabled:opacity-60"
                    >
                      {agregando === o.id ? "Agregando…" : "Agregar al carrito"}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="m-0 mt-3 text-[14px] text-[#40403A]">
          Todavía ningún taller lo ofrece. Pide que te lo fabriquen y los talleres te mandan propuestas.{" "}
          <LocalizedClientLink href="/cotizar" className="font-semibold text-[#B34D07]">Pedir propuestas →</LocalizedClientLink>
        </p>
      )}
      <p className="m-0 mt-3 text-[12px] text-[#6B6A63]">
        ¿Tienes taller con router CNC? Ofrece este mueble desde tu panel en «Ofertar en planos».
        {slug ? (
          <>
            {" "}
            <LocalizedClientLink href={`/planos/${slug}`} className="text-[#B34D07]">Ver el plano gratis</LocalizedClientLink>
          </>
        ) : null}
      </p>
    </section>
  )
}
