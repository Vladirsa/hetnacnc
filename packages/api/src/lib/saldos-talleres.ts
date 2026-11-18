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
import { T_SOBREPESO, asegurarTablaSobrepesos } from "./sobrepesos"

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

/** Pedido cancelado o reembolsado: no se le paga al taller. Un descuento por
 *  sobrepeso no se retiene: retenerlo sería perdonarle el cargo al taller. */
export async function retener(c: MedusaContainer, orderId: string, motivo: string) {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  if (esAjuste(orderId)) return 0
  return knex(T_SALDO)
    .where({ order_id: orderId })
    .whereIn("estado", ["pendiente", "disponible"])
    .update({ estado: "retenido", motivo: motivo.slice(0, 300), actualizado: knex.fn.now() })
}

/** A dónde regresa un pedido retenido al liberarlo: lo digital queda
 *  disponible al momento; lo físico vuelve a "pendiente" y la tarea
 *  (liberarVencidos) lo pasa a disponible cuando se cumpla su plazo de entrega. */
export const estadoAlLiberar = (f: { digital: boolean }): EstadoSaldo => (f.digital ? "disponible" : "pendiente")

export class SaldoNoLiberable extends Error {}

/** HETNA quita la retención de un pedido (p. ej. el reclamo se resolvió a favor
 *  del taller). Se vuelve a revisar el pedido en vivo: si está cancelado o ya
 *  no tiene pago confirmado (reembolso), no se libera. */
export async function liberarRetenido(c: MedusaContainer, orderId: string): Promise<number> {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  const f = await knex(T_SALDO).where({ order_id: orderId, estado: "retenido" }).first()
  if (!f || esAjuste(orderId)) return 0
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "status", "payment_status"], filters: { id: orderId } })
  const o = data[0] as any
  if (!o || o.status === "canceled" || !PAGADO.has(String(o.payment_status)) || String(o.payment_status) === "partially_refunded") {
    throw new SaldoNoLiberable("Este pedido está cancelado o reembolsado: no se puede liberar.")
  }
  return knex(T_SALDO)
    .where({ order_id: orderId, estado: "retenido" })
    .update({ estado: estadoAlLiberar(f), motivo: null, actualizado: knex.fn.now() })
}

// ── Sobrepesos descontados del pago al taller ──────────────────────────────────────────
// Cuando HETNA marca un sobrepeso de guía como "Descontado al taller", entra al
// saldo un renglón negativo (order_id "sobrepeso:<id>", ya "disponible"): resta
// de lo que se le transfiere en el siguiente pago y se marca pagado junto con
// sus ventas. La llave primaria evita descontarlo dos veces (doble clic). Si el
// disponible no alcanza, el saldo queda negativo y se arrastra al siguiente
// pago (la pantalla lo enseña así; no hay botón de pagar con saldo negativo).
// Sólo se descuenta al cambiar de estado: los sobrepesos que ya estaban
// "descontado" antes de esto no tienen renglón y no se vuelven a descontar
// (pudieron descontarse a mano).
export const PREFIJO_SOBREPESO = "sobrepeso:"
export const esAjuste = (orderId: string) => String(orderId || "").startsWith(PREFIJO_SOBREPESO)
export const ajusteSobrepesoId = (sobrepesoId: string) => `${PREFIJO_SOBREPESO}${sobrepesoId}`

/** Renglón del saldo que descuenta un sobrepeso (monto en MXN). */
export function filaAjusteSobrepeso(s: { id: string; folio: number | string; responsable_id: string; monto: any; referencia?: string | null }) {
  const folio = `SOB-${String(s.folio).padStart(5, "0")}`
  return {
    order_id: ajusteSobrepesoId(s.id),
    seller_id: s.responsable_id,
    display_id: null,
    moneda: "mxn",
    productos: -r2(Math.abs(Number(s.monto) || 0)),
    envio: 0,
    comision: 0,
    envio_al_taller: false,
    digital: false,
    estado: "disponible",
    disponible_en: new Date(),
    motivo: `Sobrepeso ${folio}${s.referencia ? ` (${s.referencia})` : ""}`.slice(0, 300),
  }
}

export type DecisionSobrepeso =
  | { tipo: "nada" } // ya estaba descontado (doble clic): no se toca nada
  | { tipo: "descontar" } // pasa a descontado y entra el renglón negativo
  | { tipo: "devolver" } // anular: se borra el renglón (aún no pagado)
  | { tipo: "solo_estado" } // anular uno descontado antes de esto (sin renglón)
  | { tipo: "bloqueado"; mensaje: string }
  | null // la acción no toca el saldo (sigue el flujo normal)

/** Qué le pasa al saldo con una acción sobre un sobrepeso.
 *  @param ajuste estado del renglón del saldo de ese sobrepeso, o null si no hay. */
export function decidirSobrepeso(estado: string, accion: string, ajuste: string | null): DecisionSobrepeso {
  if (estado === "descontado") {
    if (accion === "descontado") return { tipo: "nada" }
    if (accion !== "anular") return { tipo: "bloqueado", mensaje: "Este sobrepeso ya se descontó del pago al taller: sólo se puede anular." }
    if (!ajuste) return { tipo: "solo_estado" }
    if (ajuste === "disponible") return { tipo: "devolver" }
    return { tipo: "bloqueado", mensaje: "El descuento ya se aplicó en un pago al taller: si hay que devolverlo, hazlo a mano en el siguiente pago." }
  }
  if (accion === "descontado") return { tipo: "descontar" }
  return null
}

/** Aplica "descontado" o "anular" de un sobrepeso de taller junto con su efecto en
 *  el saldo, en una sola transacción. Devuelve la decisión tomada (null = la
 *  acción no toca el saldo y la ruta sigue con su flujo normal). */
export async function cambiarSobrepesoConSaldo(knex: any, s: any, accion: string): Promise<DecisionSobrepeso> {
  await asegurarTablaSaldos(knex)
  await asegurarTablaSobrepesos(knex)
  const id = ajusteSobrepesoId(s.id)
  const ajuste = await knex(T_SALDO).where({ order_id: id }).first("estado")
  const d = decidirSobrepeso(s.estado, accion, ajuste?.estado ?? null)
  if (!d || d.tipo === "nada" || d.tipo === "bloqueado") return d
  if (d.tipo === "descontar") {
    await knex.transaction(async (trx: any) => {
      // Condicionado al estado: dos clics casi juntos sólo descuentan una vez
      const n = await trx(T_SOBREPESO)
        .where({ id: s.id })
        .whereNotIn("estado", ["descontado", "pagado"])
        .update({ estado: "descontado", updated_at: trx.fn.now() })
      if (n) await trx(T_SALDO).insert(filaAjusteSobrepeso(s)).onConflict("order_id").ignore()
    })
    return d
  }
  let pagado = false
  await knex.transaction(async (trx: any) => {
    if (d.tipo === "devolver") {
      const n = await trx(T_SALDO).where({ order_id: id, estado: "disponible" }).del()
      // Se marcó pagado mientras tanto: el descuento ya se aplicó
      if (!n) {
        pagado = true
        return
      }
    }
    await trx(T_SOBREPESO).where({ id: s.id, estado: "descontado" }).update({ estado: "anulado", updated_at: trx.fn.now() })
  })
  if (pagado) return decidirSobrepeso("descontado", "anular", "pagado")
  return d
}

export class SaldoCambio extends Error {}

/** HETNA le transfirió al taller lo disponible (o los pedidos indicados).
 *  Con `totalVisto` (lo que el admin vio y transfirió), si el disponible cambió
 *  mientras tanto no se marca nada: antes se marcaba todo lo disponible, también
 *  lo que se liberó después y nunca se transfirió (auditoría Thermos, 15 nov 2026). */
export async function marcarPagado(
  c: MedusaContainer,
  sellerId: string,
  datos: { referencia: string; metodo?: string; orderIds?: string[]; totalVisto?: number; moneda?: string }
) {
  const knex = knexDe(c)
  await asegurarTablaSaldos(knex)
  let q = knex(T_SALDO).where({ seller_id: sellerId, estado: "disponible" })
  if (datos.orderIds?.length) q = q.whereIn("order_id", datos.orderIds)
  if (datos.moneda) q = q.where({ moneda: datos.moneda })
  const filas = await q.clone().select("*")
  if (datos.totalVisto != null) {
    const total = Math.round(filas.reduce((s: number, f: any) => s + netoTaller(f), 0) * 100) / 100
    if (Math.abs(total - datos.totalVisto) > 0.01) {
      throw new SaldoCambio(`El disponible cambió (ahora ${total.toFixed(2)}, viste ${datos.totalVisto.toFixed(2)}). Recarga la página y revisa antes de marcarlo.`)
    }
  }
  if (!filas.length) return 0
  return knex(T_SALDO)
    .whereIn("order_id", filas.map((f: any) => f.order_id))
    .where({ seller_id: sellerId, estado: "disponible" })
    .update({
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
    // Descuento por sobrepeso (renglón negativo), no una venta
    ajuste: esAjuste(f.order_id),
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
