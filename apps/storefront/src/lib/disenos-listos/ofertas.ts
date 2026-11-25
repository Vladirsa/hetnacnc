// Ofertas de un Diseño listo para la ficha: "Taller X te lo imprime en $Y".
// Una línea por taller con su oferta más barata (y cuántas combinaciones de
// color y calidad ofrece); primero los destacados vigentes (pagados por el
// taller) y luego por precio. Puro: se prueba sin red.
import type { StoreOffer } from "@/lib/helpers/buybox"
import { getOfferAmount, isPurchasable } from "@/lib/helpers/buybox"

export type LeyendaTaller = {
  offerId: string
  sellerId: string
  taller: string
  handle: string | null
  logo: string | null
  precio: number
  moneda: string
  /** "Negro · Estándar" de la oferta más barata */
  combinacion: string
  /** cuántas combinaciones de color y calidad ofrece este taller */
  combinaciones: number
  dias: number | null
  envioGratisDesde: number | null
  destacado: boolean
}

type VarianteConOpciones = { id: string; title?: string | null; options?: { value?: string | null; option?: { title?: string | null } | null }[] | null }

/** "Negro · Estándar" a partir de las opciones de la variante (o su título). */
export function combinacionDe(v?: VarianteConOpciones | null) {
  if (!v) return ""
  const color = v.options?.find((o) => o.option?.title === "Color")?.value
  const calidad = v.options?.find((o) => o.option?.title === "Calidad")?.value
  return color && calidad ? `${color} · ${calidad}` : String(v.title || "")
}

/** ¿El taller pagó destacar sus ofertas de Diseños listos y sigue vigente? */
export function destacadoVigente(meta: Record<string, unknown> | null | undefined, ahora = Date.now()) {
  const hasta = meta?.destacado_disenos_hasta
  const t = typeof hasta === "string" || typeof hasta === "number" ? new Date(hasta).getTime() : NaN
  return Number.isFinite(t) && t > ahora
}

export function leyendasDeTalleres(
  offers: StoreOffer[],
  variantes: VarianteConOpciones[],
  umbrales: Record<string, { gratis_desde?: number | null } | undefined> = {},
  ahora = Date.now()
): LeyendaTaller[] {
  const porVariante = new Map(variantes.map((v) => [v.id, v]))
  const porTaller = new Map<string, { mejor: StoreOffer; precio: number; n: number }>()
  for (const o of offers) {
    if (!isPurchasable(o) || !o.seller_id) continue
    const precio = getOfferAmount(o)!
    const ya = porTaller.get(o.seller_id)
    if (!ya) porTaller.set(o.seller_id, { mejor: o, precio, n: 1 })
    else {
      ya.n++
      if (precio < ya.precio) Object.assign(ya, { mejor: o, precio })
    }
  }
  const leyendas: LeyendaTaller[] = [...porTaller.entries()].map(([sellerId, { mejor, precio, n }]) => {
    const s = (mejor.seller || {}) as { name?: string | null; handle?: string | null; logo?: string | null; metadata?: Record<string, unknown> | null }
    const dias = Number((mejor.metadata as Record<string, unknown> | null)?.dias)
    return {
      offerId: mejor.id,
      sellerId,
      taller: s.name || "Taller de la red",
      handle: s.handle ?? null,
      logo: s.logo ?? null,
      precio,
      moneda: mejor.calculated_price?.currency_code || "mxn",
      combinacion: combinacionDe(porVariante.get(mejor.variant_id)),
      combinaciones: n,
      dias: Number.isFinite(dias) && dias > 0 ? dias : null,
      envioGratisDesde: umbrales[sellerId]?.gratis_desde ?? null,
      destacado: destacadoVigente(s.metadata, ahora),
    }
  })
  return leyendas.sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.precio - b.precio)
}
