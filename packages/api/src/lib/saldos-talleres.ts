// Saldo de cada taller: lo que HETNA le debe por sus ventas.
//
// Hoy todo el dinero entra a las cuentas de HETNA (Mercado Pago y PayPal) y
// HETNA le paga al taller por SPEI. Aquí se lleva la cuenta de cada pedido:
//
//   pendiente  -> se vendió un producto físico; espera la entrega
//   disponible -> ya se le puede pagar al taller
//   pagado     -> HETNA ya le transfirió (con referencia del pago)
//   retenido   -> pedido cancelado, reembolsado o en revisión: no se paga
//
// Cuándo pasa a disponible (terminos-vendedores):
//   - Diseño o archivo digital: al momento. No hay devoluciones, salvo que el
//     archivo no corresponda a lo anunciado (eso se revisa y se retiene a mano).
//   - Producto físico: DIAS_LIBERACION días (3 por omisión) después de que el
//     pedido se entrega: lo marca la guía de Skydropx (lib/guias.ts) o el
//     comprador con "Ya lo recibí" (api/store/hetna-pedidos/[id]/recibido).
//
// Lo que le toca al taller = productos - comisión de HETNA (commission_line de
// Mercur) + envío, salvo que el envío lo haya hecho HETNA con su guía (ahí el
// cobro de envío cubre la guía y se queda en HETNA).
//
// Preparado para pagar después por Mercado Pago Marketplace o PayPal
// (pago_metodo): hoy siempre "spei". Guarda la moneda de cada pedido (MXN o USD).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_GUIAS, asegurarTablaGuias } from "./guias"

export const T_SALDO = "hetna_saldo_taller"

export const ESTADOS_SALDO = {
  pendiente: "Pendiente de entrega",
  disponible: "Disponible",
  pagado: "Pagado",
  retenido: "Retenido",
} as const
export type EstadoSaldo = keyof typeof ESTADOS_SALDO

export const diasLiberacion = () => {
  const n = Number(process.env.DIAS_LIBERACION)
  return Number.isFinite(n) && n >= 0 ? n : 3
}

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
const r2 = (n: number) => Math.round(n * 100) / 100

let lista = false
export async function asegurarTablaSaldos(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_SALDO))) {
    await knex.schema.createTable(T_SALDO, (t: any) => {
      t.text("order_id").primary()
      t.text("seller_id").notNullable().index()
      t.integer("display_id")
      t.text("moneda").notNullable().defaultTo("mxn")
      t.decimal("productos", 12, 2).notNullable().defaultTo(0)
      t.decimal("envio", 12, 2).notNullable().defaultTo(0)
      t.decimal("comision", 12, 2).notNullable().defaultTo(0)
      // null mientras no se sabe; al liberar se decide si el envío es del taller
      t.boolean("envio_al_taller")
      t.boolean("digital").notNullable().defaultTo(false)
      t.text("estado").notNullable().index()
      t.timestamp("entregado_en", { useTz: true })
      t.text("entregado_por") // guia | comprador | admin
      t.timestamp("disponible_en", { useTz: true }).index()
      t.timestamp("pagado_en", { useTz: true })
      t.text("pago_metodo") // spei | mercadopago | paypal
      t.text("pago_referencia")
      t.text("motivo")
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("actualizado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

/** Lo que le toca al taller por un renglón del saldo. */
export function netoTaller(f: { productos: any; envio: any; comision: any; envio_al_taller: boolean | null }) {
  const envio = f.envio_al_taller === false ? 0 : Number(f.envio) || 0
  return r2((Number(f.productos) || 0) - (Number(f.comision) || 0) + envio)
}

const PAGADO = new Set(["captured", "partially_captured", "authorized", "partially_authorized", "partially_refunded"])

/**
 * Registra (una sola vez) un pedido en el saldo de su taller. Se llama al
 * crearse el pedido y desde la tarea que barre los que faltan: si el pago aún
 * no está confirmado, no hace nada y lo reintenta la tarea.
 */
export async function registrarVenta(c: MedusaContainer, orderId: string): Promise<boolean> {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  if (await knex(T_SALDO).where({ order_id: orderId }).first("order_id")) return false

  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data: pedidos } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "currency_code", "status", "payment_status", "shipping_total",
      "items.id", "items.product_id", "items.quantity", "items.unit_price", "items.total",
    ],
    filters: { id: orderId },
  })
  const o = pedidos[0] as any
  if (!o || o.status === "canceled" || !PAGADO.has(String(o.payment_status))) return false

  const { data: vinculos } = await query.graph({
    entity: "order_seller",
    fields: ["seller_id"],
    filters: { order_id: orderId } as any,
  })
  const sellerId = (vinculos[0] as any)?.seller_id
  if (!sellerId) return false

  const items = (o.items || []) as any[]
  const productos = r2(
    items.reduce((s, i) => s + (Number(i.total) || (Number(i.unit_price) || 0) * (Number(i.quantity) || 0)), 0)
  )

  let comision = 0
  const itemIds = items.map((i) => i.id).filter(Boolean)
  if (itemIds.length) {
    const { data: lineas } = await query.graph({
      entity: "commission_line",
      fields: ["amount"],
      filters: { item_id: itemIds } as any,
    })
    comision = r2(lineas.reduce((s, l: any) => s + (Number(l.amount) || 0), 0))
  }

  // Digital = todos los productos del pedido son archivos (sin envío físico)
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
  let digital = false
  if (productIds.length) {
    const { data: prods } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: productIds } })
    digital = prods.length > 0 && prods.every((p: any) => p?.metadata?.producto_digital === true)
  }

  const ahora = new Date()
  await knex(T_SALDO)
    .insert({
      order_id: o.id,
      seller_id: sellerId,
      display_id: o.display_id ?? null,
      moneda: String(o.currency_code || "mxn").toLowerCase(),
      productos,
      envio: r2(Number(o.shipping_total) || 0),
      comision,
      envio_al_taller: digital ? false : null,
      digital,
      estado: digital ? "disponible" : "pendiente",
      disponible_en: digital ? ahora : null,
    })
    .onConflict("order_id")
    .ignore()
  return true
}

/**
 * El pedido se entregó: arranca la cuenta de DIAS_LIBERACION días. Si ya
 * estaba marcado, no se mueve la fecha (gana la primera entrega).
 */
export async function marcarEntregado(c: MedusaContainer, orderId: string, por: "guia" | "comprador" | "admin") {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  await registrarVenta(c, orderId).catch(() => false)
  const ahora = new Date()
  const libera = new Date(ahora.getTime() + diasLiberacion() * 24 * 60 * 60 * 1000)
  return knex(T_SALDO)
    .where({ order_id: orderId, estado: "pendiente" })
    .whereNull("entregado_en")
    .update({ entregado_en: ahora, entregado_por: por, disponible_en: libera, actualizado: knex.fn.now() })
}

/** Pasa a disponible lo que ya cumplió su plazo. Lo llama la tarea programada. */
export async function liberarVencidos(c: MedusaContainer): Promise<number> {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  await asegurarTablaGuias(knex)
  const filas = await knex(T_SALDO)
    .where({ estado: "pendiente" })
    .whereNotNull("disponible_en")
    .where("disponible_en", "<=", new Date())
    .select("order_id")
  let n = 0
  for (const f of filas) {
    // Si HETNA hizo la guía, el envío que pagó el cliente cubre esa guía
    const guia = await knex(T_GUIAS).where({ order_id: f.order_id }).first("order_id")
    n += await knex(T_SALDO)
      .where({ order_id: f.order_id, estado: "pendiente" })
      .update({ estado: "disponible", envio_al_taller: !guia, actualizado: knex.fn.now() })
  }
  return n
}

/** Barre pedidos recientes que no entraron al saldo (pago confirmado tarde). */
export async function registrarFaltantes(c: MedusaContainer, dias = 30): Promise<number> {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  const filas = await knex("order")
    .whereNull("deleted_at")
    .where("created_at", ">", desde)
    .whereNotIn("id", knex(T_SALDO).select("order_id"))
    .select("id")
    .limit(200)
  let n = 0
  for (const f of filas) if (await registrarVenta(c, f.id).catch(() => false)) n++
  return n
}

/** Pedido cancelado o reembolsado: no se le paga al taller. */
export async function retener(c: MedusaContainer, orderId: string, motivo: string) {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  return knex(T_SALDO)
    .where({ order_id: orderId })
    .whereIn("estado", ["pendiente", "disponible"])
    .update({ estado: "retenido", motivo: motivo.slice(0, 300), actualizado: knex.fn.now() })
}

/** HETNA le transfirió al taller todo lo disponible (o los pedidos indicados). */
export async function marcarPagado(
  c: MedusaContainer,
  sellerId: string,
  datos: { referencia: string; metodo?: string; orderIds?: string[] }
) {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  let q = knex(T_SALDO).where({ seller_id: sellerId, estado: "disponible" })
  if (datos.orderIds?.length) q = q.whereIn("order_id", datos.orderIds)
  return q.update({
    estado: "pagado",
    pagado_en: new Date(),
    pago_metodo: (datos.metodo || "spei").slice(0, 20),
    pago_referencia: datos.referencia.slice(0, 120),
    actualizado: knex.fn.now(),
  })
}

export function filaParaRespuesta(f: any) {
  return {
    order_id: f.order_id,
    display_id: f.display_id,
    moneda: f.moneda,
    productos: Number(f.productos),
    envio: Number(f.envio),
    comision: Number(f.comision),
    neto: netoTaller(f),
    digital: f.digital,
    estado: f.estado,
    estado_nombre: ESTADOS_SALDO[f.estado as EstadoSaldo] || f.estado,
    entregado_en: f.entregado_en,
    disponible_en: f.disponible_en,
    pagado_en: f.pagado_en,
    pago_metodo: f.pago_metodo,
    pago_referencia: f.pago_referencia,
    motivo: f.motivo,
    creado: f.creado,
  }
}

/** Totales por estado y moneda de un taller (o de todos si sellerId es null). */
export async function resumenSaldos(knex: any, sellerId: string | null) {
  await asegurarTablaSaldos(knex)
  let q = knex(T_SALDO).select("seller_id", "estado", "moneda", "productos", "envio", "comision", "envio_al_taller")
  if (sellerId) q = q.where({ seller_id: sellerId })
  const filas = await q
  const out: Record<string, Record<string, number>> = {}
  for (const f of filas) {
    const m = (out[f.moneda] ||= { pendiente: 0, disponible: 0, pagado: 0, retenido: 0 })
    m[f.estado] = r2((m[f.estado] || 0) + netoTaller(f))
  }
  return out
}
