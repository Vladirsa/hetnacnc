// Seguimiento del pedido por WhatsApp, al estilo de las tiendas grandes
// (decidido por Vlado el 14 nov 2026): recibido → va en camino → entregado (o
// cancelado), cada uno con su liga.
//
// Sólo a clientes que VERIFICARON su WhatsApp y no escribieron BAJA (lib/whatsapp.ts):
// ellos escribieron primero, así WhatsApp no lo ve como spam. Cada aviso sale una
// sola vez por pedido y etapa (tabla hetna_wa_pedido), aunque el evento llegue
// dos veces. Si el cliente verifica su número DESPUÉS de comprar, se le manda el
// estado de sus pedidos abiertos en ese momento.
import { clientesConCorreoConfiable } from "./verificar-correo"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_GUIAS } from "./guias"
import { STORE_URL } from "./licitacion"
import { T_WA, asegurarWhatsapp, enviarTexto, whatsappListo } from "./whatsapp"

export const T_WA_PEDIDO = "hetna_wa_pedido"
export type EtapaPedido = "recibido" | "en_camino" | "entregado" | "cancelado"

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  await asegurarWhatsapp(knex)
  if (!(await knex.schema.hasTable(T_WA_PEDIDO))) {
    await knex.schema.createTable(T_WA_PEDIDO, (t: any) => {
      t.text("order_id").notNullable()
      t.text("etapa").notNullable()
      t.text("numero").notNullable()
      t.timestamp("enviado_en", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["order_id", "etapa", "numero"])
    })
  }
  listo = true
}

export type DatosPedido = {
  id: string
  numero: string // #1023
  nombre: string
  articulos: number
  total: string
  digital: boolean
  entregado: boolean
  envio: string
  paqueteria: string
  guia: string
  rastreo: string
  customerId: string | null
  email: string | null
}

const dinero = (n: number, moneda = "mxn") =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: moneda.toUpperCase() })

export const ligaPedido = (id: string) => `${STORE_URL}/mx/user/orders/${id}`

/**
 * Compra digital: sin envío, o sólo con "Entrega digital" (el taller de puros
 * digitales la elige al pagar, lib/envios-automaticos.ts). Antes sólo contaba
 * "sin envío" y a una compra digital le llegaba "el taller lo está preparando".
 */
export const esPedidoDigital = (metodos?: ({ name?: string | null } | null)[] | null) =>
  !(metodos || []).length || (metodos || []).every((m) => /entrega digital/i.test(String(m?.name || "")))
const PIE = `Escribe "Hola" en cualquier momento si tienes una duda. 💬\n_Escribe BAJA para no recibir avisos._`

/** El texto de cada etapa. Corto, con el número de pedido y su liga, como las tiendas grandes. */
export function textoPedido(etapa: EtapaPedido, d: DatosPedido): string {
  const hola = d.nombre ? `¡Hola ${d.nombre}! ` : "¡Hola! "
  const arts = `${d.articulos} artículo${d.articulos === 1 ? "" : "s"}`
  const detalles = `Ve los detalles del pedido: ${ligaPedido(d.id)}`
  if (etapa === "recibido") {
    if (d.digital) {
      return `${hola}Tu compra ${d.numero} con ${arts} está lista 🎉 Total: ${d.total}.\n\nDescarga tus archivos aquí: ${STORE_URL}/mx/user/descargas\n\n${PIE}`
    }
    return (
      `${hola}Tu pedido ${d.numero} con ${arts} ha sido recibido 📦 Total: ${d.total}.` +
      `${d.envio ? ` Envío: ${d.envio}.` : ""} El taller ya lo está preparando y te avisaremos por aquí cuando vaya en camino ✨\n\n` +
      `${detalles}\n\n${PIE}`
    )
  }
  if (etapa === "en_camino") {
    const guia = [d.paqueteria && `Paquetería: ${d.paqueteria}`, d.guia && `Guía: ${d.guia}`].filter(Boolean).join(" · ")
    return (
      `🚚 ${hola}Tu pedido ${d.numero} va en camino.` +
      `${guia ? `\n${guia}` : ""}${d.rastreo ? `\nRastréalo aquí: ${d.rastreo}` : ""}\n\n${detalles}\n\n${PIE}`
    )
  }
  if (etapa === "entregado") {
    return (
      `✅ ${hola}Tu pedido ${d.numero} fue entregado. ¡Esperamos que te encante!\n\n` +
      `¿Nos ayudas calificando tu compra? Toma un minuto y ayuda a otros clientes: ${ligaPedido(d.id)}\n\n` +
      `¿Algún problema con tu pedido? Escríbenos aquí y te ayudamos.\n_Escribe BAJA para no recibir avisos._`
    )
  }
  return (
    `${hola}Tu pedido ${d.numero} fue cancelado. Si ya lo pagaste, el reembolso se hace al mismo medio de pago.\n\n` +
    `${detalles}\n\n${PIE}`
  )
}

export async function datosPedido(container: any, orderId: string): Promise<DatosPedido | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "email", "customer_id", "total", "currency_code",
      "shipping_address.first_name", "customer.first_name",
      "items.quantity", "shipping_methods.name",
      "fulfillments.canceled_at", "fulfillments.delivered_at", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url",
    ],
    filters: { id: orderId },
  })
  const o = data?.[0] as any
  if (!o) return null
  const guia = await knex(T_GUIAS).where({ order_id: o.id }).first().catch(() => null)
  const etiqueta = (o.fulfillments || [])
    .filter((f: any) => !f.canceled_at)
    .flatMap((f: any) => f.labels || [])
    .find((l: any) => l?.tracking_number)
  const nombre = String(o.customer?.first_name || o.shipping_address?.first_name || "").trim().split(/\s+/)[0] || ""
  return {
    id: o.id,
    numero: `#${o.display_id}`,
    nombre,
    articulos: (o.items || []).reduce((a: number, i: any) => a + Number(i.quantity || 0), 0),
    total: dinero(o.total, o.currency_code || "mxn"),
    digital: esPedidoDigital(o.shipping_methods),
    entregado: (o.fulfillments || []).some((f: any) => !f.canceled_at && f.delivered_at),
    envio: String(o.shipping_methods?.[0]?.name || ""),
    paqueteria: String(guia?.paqueteria || ""),
    guia: String(guia?.guia || etiqueta?.tracking_number || ""),
    rastreo: String(guia?.rastreo_url || etiqueta?.tracking_url || ""),
    customerId: o.customer_id || null,
    email: o.email || null,
  }
}

/** Números verificados (con avisos) del cliente del pedido: por su cuenta y por su correo. */
async function numerosDelCliente(knex: any, d: { customerId: string | null; email: string | null }): Promise<string[]> {
  const ids = new Set<string>()
  if (d.customerId) ids.add(d.customerId)
  // Por correo sólo las cuentas con el correo confirmado (auditoría Thermos)
  if (d.email) for (const id of await clientesConCorreoConfiable(knex, d.email)) ids.add(id)
  if (!ids.size) return []
  const filas = await knex(T_WA).whereNotNull("verificado_en").where("avisos", true).whereIn("customer_id", [...ids]).select("numero")
  return [...new Set<string>(filas.map((f: any) => String(f.numero)))]
}

/** Manda el aviso de una etapa del pedido. Nunca truena el flujo que lo llama. */
export async function avisarPedidoWhatsapp(container: any, orderId: string, etapa: EtapaPedido, logger?: any): Promise<number> {
  try {
    if (!whatsappListo()) return 0
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await asegurar(knex)
    const d = await datosPedido(container, orderId)
    if (!d) return 0
    // Una compra digital no va en camino ni se entrega por paquetería
    if (d.digital && (etapa === "en_camino" || etapa === "entregado")) return 0
    const numeros = await numerosDelCliente(knex, d)
    let n = 0
    for (const numero of numeros) {
      // Reserva la etapa antes de mandar: si el evento llega dos veces, sale una
      const reservado = await knex(T_WA_PEDIDO).insert({ order_id: d.id, etapa, numero }).onConflict(["order_id", "etapa", "numero"]).ignore().returning("order_id")
      if (!reservado?.length) continue
      try {
        await enviarTexto(numero, textoPedido(etapa, d))
        n++
      } catch (e) {
        await knex(T_WA_PEDIDO).where({ order_id: d.id, etapa, numero }).del().catch(() => null)
        logger?.warn?.(`[whatsapp-pedido] ${d.numero} ${etapa}: ${(e as Error).message}`)
      }
    }
    if (n) logger?.info?.(`[whatsapp-pedido] ${d.numero} ${etapa}: ${n} aviso(s)`)
    return n
  } catch (e) {
    logger?.warn?.(`[whatsapp-pedido] ${orderId} ${etapa}: ${(e as Error).message}`)
    return 0
  }
}

/** El pedido de un envío (los eventos de envío y entrega traen el id del fulfillment). */
export async function pedidoDeEnvio(container: any, fulfillmentId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order_fulfillment", fields: ["order_id"], filters: { fulfillment_id: fulfillmentId } as any })
  return (data?.[0] as any)?.order_id || null
}

/**
 * Acaba de verificar su WhatsApp: le manda cómo van sus pedidos de los últimos
 * 30 días que no se han entregado ni cancelado (máximo 3), para que el
 * seguimiento siga por aquí.
 */
export async function ponerAlDiaPedidos(container: any, customerId: string, logger?: any): Promise<number> {
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const filas = await knex("order")
      .where({ customer_id: customerId })
      .whereNull("deleted_at")
      .whereNull("canceled_at")
      .where("created_at", ">=", knex.raw("now() - interval '30 days'"))
      .orderBy("created_at", "desc")
      .limit(3)
      .select("id")
    let n = 0
    for (const f of filas) {
      const d = await datosPedido(container, f.id)
      if (!d || d.digital || d.entregado) continue
      const etapa: EtapaPedido = d.guia || d.rastreo ? "en_camino" : "recibido"
      n += await avisarPedidoWhatsapp(container, f.id, etapa, logger)
    }
    return n
  } catch (e) {
    logger?.warn?.(`[whatsapp-pedido] poner al día ${customerId}: ${(e as Error).message}`)
    return 0
  }
}
