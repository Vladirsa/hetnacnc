// Correos del pedido (lib/correo-pedidos.ts):
//   order.placed     -> cliente: «Recibimos tu pedido #123» · taller: «Pedido nuevo #123»
//   shipment.created -> cliente: «Tu pedido #123 va en camino» (paquetería, guía y rastreo)
//   order.canceled   -> cliente: «Tu pedido #123 fue cancelado»
// Una vez por pedido, etapa y destinatario.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { type EtapaCorreo, correoPedido } from "../lib/correo-pedidos"
import { pedidoDeEnvio } from "../lib/whatsapp-pedidos"

const ETAPAS: Record<string, EtapaCorreo[]> = {
  "order.placed": ["recibido", "taller_nuevo"],
  "shipment.created": ["en_camino"],
  "order.canceled": ["cancelado"],
}

export default async function correoPedidoSubscriber({ event, container }: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  const logger = container.resolve("logger")
  const etapas = ETAPAS[event.name]
  if (!etapas || !event.data?.id || event.data.no_notification) return
  try {
    const orderId = event.name === "shipment.created" ? await pedidoDeEnvio(container, event.data.id) : event.data.id
    if (!orderId) return
    // Unos segundos para que la guía (paquetería y rastreo) ya esté guardada
    if (event.name === "shipment.created") await new Promise((ok) => setTimeout(ok, 5000))
    await correoPedido(container, orderId, etapas, logger)
  } catch (e) {
    logger.warn(`[correo-pedido] ${event.name} ${event.data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "shipment.created", "order.canceled"],
}
