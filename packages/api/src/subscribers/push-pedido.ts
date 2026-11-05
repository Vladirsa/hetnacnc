import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { pushACliente, pushATalleres, pushListo } from "../lib/push"

// Aviso al celular (lib/push.ts) cuando entra un pedido:
//   · al taller: "Pedido nuevo #123", lo lleva a su panel
//   · al cliente: "Recibimos tu pedido", lo lleva a Mis pedidos
// Cancelado: se le avisa a los dos.
export default async function pushPedido({ event, container }: SubscriberArgs<{ id: string }>) {
  if (!pushListo()) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  try {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "customer_id", "total", "currency_code", "items.title", "items.quantity"],
      filters: { id: event.data.id },
    })
    const o = data?.[0] as any
    if (!o) return
    const { data: enlaces } = await query.graph({
      entity: "order_seller",
      fields: ["seller_id"],
      filters: { order_id: o.id } as any,
    })
    const talleres = ((enlaces || []) as any[]).map((e) => e.seller_id)
    const items = (o.items || []) as { title: string; quantity: number }[]
    const resumen = items.length
      ? `${items[0].quantity} × ${items[0].title}${items.length > 1 ? ` y ${items.length - 1} más` : ""}`
      : "Revisa los detalles"
    const total = Number(o.total || 0).toLocaleString("es-MX", { style: "currency", currency: (o.currency_code || "mxn").toUpperCase() })

    if (event.name === "order.canceled") {
      await pushATalleres(knex, talleres, { titulo: `Pedido #${o.display_id} cancelado`, cuerpo: "No lo prepares ni lo envíes.", url: `/seller/orders/${o.id}`, etiqueta: `pedido-${o.id}` }, logger)
      await pushACliente(knex, { customerId: o.customer_id, email: o.email }, { titulo: `Tu pedido #${o.display_id} fue cancelado`, cuerpo: "Si pagaste, el reembolso se hace al mismo medio de pago.", url: "/mx/user/orders", etiqueta: `pedido-${o.id}` }, logger)
      return
    }
    await pushATalleres(
      knex,
      talleres,
      { titulo: `¡Pedido nuevo #${o.display_id}! ${total}`, cuerpo: `${resumen}. Prepáralo y genera la guía desde tu panel.`, url: `/seller/orders/${o.id}`, etiqueta: `pedido-${o.id}` },
      logger
    )
    await pushACliente(
      knex,
      { customerId: o.customer_id, email: o.email },
      { titulo: `Recibimos tu pedido #${o.display_id}`, cuerpo: "Te avisaremos aquí cuando vaya en camino.", url: "/mx/user/orders", etiqueta: `pedido-${o.id}` },
      logger
    )
  } catch (e) {
    logger.warn(`[push] pedido ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}
