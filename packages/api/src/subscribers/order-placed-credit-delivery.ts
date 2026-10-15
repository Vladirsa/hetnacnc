import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { grantCreditsForOrder } from "../lib/credit-delivery"

// Cubre el caso en que el proveedor de pago captura en el mismo paso que
// autoriza. Si el pago todavia no esta capturado cuando esto corre,
// grantCreditsForOrder no hace nada y queda en manos de
// payment-captured-credit-delivery.ts.
export default async function orderPlacedCreditDelivery({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    await grantCreditsForOrder(container, event.data.id)
  } catch (e) {
    logger.error(`[credit-delivery] fallo para order ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
