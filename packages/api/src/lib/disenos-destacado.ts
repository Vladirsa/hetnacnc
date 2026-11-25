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
import { STORE_URL, crearPreferenciaPago, nuevoId } from "./licitacion"

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

/** Hasta cuándo está destacado el taller (null si no o ya venció). */
export function destacadoHasta(meta: Record<string, unknown> | null | undefined, ahora = Date.now()): string | null {
  const v = meta?.destacado_disenos_hasta
  const t = typeof v === "string" || typeof v === "number" ? new Date(v).getTime() : NaN
  return Number.isFinite(t) && t > ahora ? new Date(t).toISOString() : null
}

/** Crea el pedido de destacado y su liga de pago. url null si no hay Mercado Pago configurado. */
export async function crearPagoDestacado(knex: any, sellerId: string, dias: number, email?: string | null) {
  const monto = precioDestacado(dias)
  if (!monto) throw new Error("Ese plan no existe.")
  await asegurarTablaDestacado(knex)
  const id = nuevoId("dst")
  await knex(T_DESTACADO).insert({ id, seller_id: sellerId, dias, monto })
  const r = await crearPreferenciaPago({
    solicitudId: id,
    folio: id,
    titulo: `Destacado ${dias} días en Piezas para imprimir · HETNA CNC`,
    monto,
    email: email || undefined,
    retorno: `${STORE_URL}/seller/piezas-imprimir`,
    referencia: `destacado:${id}`,
    webhook: process.env.MP_WEBHOOK_ENVIO_URL || `${STORE_URL}/api/mp-envio`,
    idempotencia: `dst-${id}`,
  })
  return { id, url: r?.url ?? null }
}

/** Que la tienda vuelva a leer las ofertas (y la metadata de los talleres que traen). */
async function revalidarOfertas(logger: any) {
  const url = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET
  if (!url || !secret) return
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-revalidate-secret": secret }, body: JSON.stringify({ tags: ["offers", "products"] }) }).catch((e) =>
    logger.warn(`[destacado] no se pudo refrescar la tienda: ${(e as Error).message}`)
  )
}

const pagoValido = (pago: any, monto: number) => pago.status === "approved" && pago.currency_id === "MXN" && Math.abs(Number(pago.transaction_amount || 0) - Number(monto)) <= 0.01

/**
 * Aviso de pago (desde /api/mp-envio, external_reference "destacado:<id>"):
 * con el pago aprobado y el monto exacto, marca el pedido y extiende el
 * destacado del taller. El mismo aviso dos veces no suma dos veces; un SEGUNDO
 * pago de la misma liga (otro id de pago) sí suma sus días: se cobró.
 */
export async function pagoDeDestacado(knex: any, logger: any, pago: any, id: string) {
  await asegurarTablaDestacado(knex)
  const p = await knex(T_DESTACADO).where({ id }).first()
  if (!p) return
  if (p.estado === "pagado" && p.pago_id === String(pago.id)) return // aviso repetido
  if (!pagoValido(pago, Number(p.monto))) {
    if (pago.status === "approved") logger.error(`[destacado] ${id} pago ${pago.id} con monto o moneda inesperados (${pago.transaction_amount} ${pago.currency_id}, esperado ${p.monto} MXN)`)
    else logger.info(`[destacado] ${id} pago ${pago.id} en estado ${pago.status}`)
    return
  }
  let aplicado = false
  await knex.transaction(async (trx: any) => {
    let pedidoId = id
    if (p.estado === "pagado") {
      // la misma liga se pagó otra vez: otro pedido igual, ya pagado
      const ya = await trx(T_DESTACADO).where({ pago_id: String(pago.id) }).first("id")
      if (ya) return
      pedidoId = nuevoId("dst")
      await trx(T_DESTACADO).insert({ id: pedidoId, seller_id: p.seller_id, dias: p.dias, monto: p.monto, estado: "pagado", pago_id: String(pago.id) })
      logger.warn(`[destacado] ${id}: segundo pago ${pago.id} de la misma liga; se suman sus días (${pedidoId})`)
    } else {
      // sólo uno gana si llegan dos avisos al mismo tiempo
      const n = await trx(T_DESTACADO).where({ id, estado: "pendiente" }).update({ estado: "pagado", pago_id: String(pago.id), updated_at: trx.fn.now() })
      if (!n) return
    }
    // FOR UPDATE: dos pagos del mismo taller a la vez no se pisan los días
    const s = await trx("seller").where({ id: p.seller_id }).forUpdate().first("metadata")
    const hasta = nuevoHasta(s?.metadata?.destacado_disenos_hasta, Number(p.dias))
    await trx(T_DESTACADO).where({ id: pedidoId }).update({ hasta })
    await trx.raw(`UPDATE seller SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('destacado_disenos_hasta', ?::text) WHERE id = ?`, [hasta.toISOString(), p.seller_id])
    logger.info(`[destacado] ${p.seller_id} destacado hasta ${hasta.toISOString()} (pago ${pago.id})`)
    aplicado = true
  })
  if (aplicado) await revalidarOfertas(logger)
}
