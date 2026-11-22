import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"

import { grantCreditsForOrder } from "../lib/credit-delivery"
import { pedidosDelCobro } from "../lib/pago-pedido"

// Mismo patron que payment-captured-digital-delivery.ts: payment.captured
// solo trae el id del pago, se resuelve la orden via el link
// order_payment_collection.
export default async function paymentCapturedCreditDelivery({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    const paymentModuleService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const payment = await paymentModuleService.retrievePayment(event.data.id)

    // Pedido de un solo cobro o pedidos divididos de Mercur (el cobro está en el carrito)
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    for (const orderId of await pedidosDelCobro(knex, payment.payment_collection_id)) {
      await grantCreditsForOrder(container, orderId)
    }
  } catch (e) {
    logger.error(`[credit-delivery] fallo resolviendo orden para payment ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
