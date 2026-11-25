// Destacado de talleres en las Piezas para imprimir (Diseños listos).
//
// El taller paga por días (Mercado Pago) y mientras dure sale primero, con la
// etiqueta "Destacado", en el bloque "Quién te lo imprime" de TODAS las piezas
// que ofrece (apps/storefront/src/lib/disenos-listos/ofertas.ts lee
// seller.metadata.destacado_disenos_hasta). Comprar otra vez antes de que
// termine suma los días al final.
//
// Precios: DESTACADO_PRECIO_7 y DESTACADO_PRECIO_30 (MXN, con IVA); si no, los
// de PLANES_DESTACADO.
import { STORE_URL, nuevoId } from "./licitacion"

export const T_DESTACADO = "hetna_destacado_disenos"
export const PLANES_DESTACADO: Record<number, number> = { 7: 199, 30: 599 }
const DIA = 86_400_000

export const precioDestacado = (dias: number) => {
  const env = Number(process.env[`DESTACADO_PRECIO_${dias}`])
  return env > 0 ? env : PLANES_DESTACADO[dias] ?? null
}
export const planesDestacado = () => Object.keys(PLANES_DESTACADO).map((d) => ({ dias: Number(d), precio: precioDestacado(Number(d))! }))

let listo = false
export async function asegurarTablaDestacado(knex: any) {
  if (listo) return
  await knex.raw(`CREATE TABLE IF NOT EXISTS ${T_DESTACADO} (
    id text PRIMARY KEY,
    seller_id text NOT NULL,
    dias integer NOT NULL,
    monto numeric(12,2) NOT NULL,
    estado text NOT NULL DEFAULT 'pendiente',
    pago_id text,
    hasta timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  await knex.raw(`CREATE INDEX IF NOT EXISTS ${T_DESTACADO}_seller ON ${T_DESTACADO} (seller_id)`)
  listo = true
}

/** Hasta cuándo queda destacado si hoy paga `dias` (suma al final del vigente). */
export function nuevoHasta(vigente: unknown, dias: number, ahora = Date.now()) {
  const t = typeof vigente === "string" || typeof vigente === "number" ? new Date(vigente).getTime() : NaN
  const base = Number.isFinite(t) && t > ahora ? t : ahora
  return new Date(base + dias * DIA)
}

const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

/** Crea el pedido de destacado y su liga de pago. null si no hay Mercado Pago configurado. */
export async function crearPagoDestacado(knex: any, sellerId: string, dias: number, email?: string | null) {
  const monto = precioDestacado(dias)
  if (!monto) throw new Error("Ese plan no existe.")
  await asegurarTablaDestacado(knex)
  const id = nuevoId("dst")
  await knex(T_DESTACADO).insert({ id, seller_id: sellerId, dias, monto })
  if (!mpToken()) return { id, url: null as string | null }
  const r = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", "X-Idempotency-Key": `dst-${id}` },
    body: JSON.stringify({
      items: [{ id, title: `Destacado ${dias} días en Piezas para imprimir · HETNA CNC`, quantity: 1, unit_price: monto, currency_id: "MXN" }],
      payer: email ? { email } : undefined,
      external_reference: `destacado:${id}`,
      back_urls: { success: `${STORE_URL}/seller/piezas-imprimir`, failure: `${STORE_URL}/seller/piezas-imprimir`, pending: `${STORE_URL}/seller/piezas-imprimir` },
      auto_return: "approved",
      statement_descriptor: "HETNA CNC",
      notification_url: process.env.MP_WEBHOOK_ENVIO_URL || `${STORE_URL}/api/mp-envio`,
    }),
  })
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = (await r.json()) as { init_point: string; sandbox_init_point?: string }
  return { id, url: (mpToken().startsWith("TEST-") && d.sandbox_init_point) || d.init_point }
}

/**
 * Aviso de pago (desde /api/mp-envio, external_reference "destacado:<id>"):
 * con el pago aprobado y el monto exacto, marca el pedido y extiende el
 * destacado del taller. Se puede llamar dos veces sin sumar dos veces.
 */
export async function pagoDeDestacado(knex: any, logger: any, pago: any, id: string) {
  await asegurarTablaDestacado(knex)
  const p = await knex(T_DESTACADO).where({ id }).first()
  if (!p || p.estado === "pagado") return
  if (pago.status !== "approved") {
    logger.info(`[destacado] ${id} pago ${pago.id} en estado ${pago.status}`)
    return
  }
  if (pago.currency_id !== "MXN" || Math.abs(Number(pago.transaction_amount || 0) - Number(p.monto)) > 0.01) {
    logger.error(`[destacado] ${id} pago ${pago.id} con monto o moneda inesperados (${pago.transaction_amount} ${pago.currency_id}, esperado ${p.monto} MXN)`)
    return
  }
  await knex.transaction(async (trx: any) => {
    // sólo uno gana si llegan dos avisos al mismo tiempo
    const n = await trx(T_DESTACADO).where({ id, estado: "pendiente" }).update({ estado: "pagado", pago_id: String(pago.id), updated_at: trx.fn.now() })
    if (!n) return
    const s = await trx("seller").where({ id: p.seller_id }).first("metadata")
    const hasta = nuevoHasta(s?.metadata?.destacado_disenos_hasta, Number(p.dias))
    await trx(T_DESTACADO).where({ id }).update({ hasta })
    await trx.raw(`UPDATE seller SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('destacado_disenos_hasta', ?::text) WHERE id = ?`, [hasta.toISOString(), p.seller_id])
    logger.info(`[destacado] ${p.seller_id} destacado hasta ${hasta.toISOString()} (pago ${pago.id})`)
  })
}
