import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"

import { grantCreditsForOrder } from "../lib/credit-delivery"

// Mismo patron que payment-captured-digital-delivery.ts: payment.captured
// solo trae el id del pago, se resuelve la orden via el link
// order_payment_collection.
export default async function paymentCapturedCreditDelivery({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const paymentModuleService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const payment = await paymentModuleService.retrievePayment(event.data.id)

    const {
      data: [orderPaymentLink],
    } = await query.graph({
      entity: "order_payment_collection",
      fields: ["order.id"],
      filters: { payment_collection_id: payment.payment_collection_id },
    })

    const orderId = (orderPaymentLink as any)?.order?.id
    if (!orderId) {
      return
    }

    await grantCreditsForOrder(container, orderId)
  } catch (e) {
    logger.error(`[credit-delivery] fallo resolviendo orden para payment ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
