import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"

import { deliverDigitalProductsForOrder } from "../lib/digital-delivery"

// Cubre el caso en que la captura de pago ocurre despues de order.placed
// (captura manual o asincrona). payment.captured solo trae el id del pago,
// no el de la orden, asi que hay que resolverlo via el link
// order_payment_collection (mismo patron que usa el workflow nativo
// capture-payment de Medusa para registrar la transaccion de la orden).
export default async function paymentCapturedDigitalDelivery({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
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

    await deliverDigitalProductsForOrder(container, orderId)
  } catch (e) {
    logger.error(`[digital-delivery] fallo resolviendo orden para payment ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
