import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { type EtapaPedido, avisarPedidoWhatsapp, pedidoDeEnvio } from "../lib/whatsapp-pedidos"

// Seguimiento del pedido por WhatsApp (lib/whatsapp-pedidos.ts):
//   order.placed      -> «Tu pedido #123 con 2 artículos ha sido recibido 📦»
//   shipment.created  -> «Tu pedido #123 va en camino 🚚» (paquetería, guía y rastreo)
//   delivery.created  -> «Tu pedido #123 fue entregado ✅» (y pide calificar)
//   order.canceled    -> «Tu pedido #123 fue cancelado»
// Sólo a clientes con WhatsApp verificado; una vez por pedido y etapa.
const ETAPA: Record<string, EtapaPedido> = {
  "order.placed": "recibido",
  "shipment.created": "en_camino",
  "delivery.created": "entregado",
  "order.canceled": "cancelado",
}

export default async function whatsappPedido({ event, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  const logger = container.resolve("logger")
  const etapa = ETAPA[event.name]
  if (!etapa || !event.data?.id || event.data.no_notification) return
  try {
    const orderId = etapa === "en_camino" || etapa === "entregado" ? await pedidoDeEnvio(container, event.data.id) : event.data.id
    if (!orderId) return
    // Unos segundos para que la guía (paquetería y rastreo) ya esté guardada
    if (etapa === "en_camino") await new Promise((ok) => setTimeout(ok, 5000))
    await avisarPedidoWhatsapp(container, orderId, etapa, logger)
  } catch (e) {
    logger.warn(`[whatsapp-pedido] ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "shipment.created", "delivery.created", "order.canceled"],
}
