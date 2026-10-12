import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { deliverDigitalProductsForOrder } from "../lib/digital-delivery"

// Cubre el caso en que el proveedor de pago captura en el mismo paso que
// autoriza (algunos metodos de MercadoPago). Si el pago todavia no esta
// capturado cuando esto corre, deliverDigitalProductsForOrder no hace nada
// y queda en manos de payment-captured-digital-delivery.ts.
export default async function orderPlacedDigitalDelivery({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await deliverDigitalProductsForOrder(container, event.data.id)
  } catch (e) {
    logger.error(`[digital-delivery] fallo para order ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
