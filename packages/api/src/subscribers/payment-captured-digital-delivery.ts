import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IPaymentModuleService } from "@medusajs/framework/types"

import { deliverDigitalProductsForOrder } from "../lib/digital-delivery"
import { pedidosDelCobro } from "../lib/pago-pedido"

// Captura después del pedido (proveedores que no cobran al autorizar, o una
// captura manual desde el panel). payment.captured sólo trae el id del pago:
// los pedidos se buscan por el cobro, directo o por el carrito (pedidos
// divididos de Mercur, lib/pago-pedido.ts). La entrega no se repite: el pedido
// guarda que ya se entregó.
export default async function paymentCapturedDigitalDelivery({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    const paymentModuleService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const payment = await paymentModuleService.retrievePayment(event.data.id)

    // Pedido de un solo cobro o pedidos divididos de Mercur (el cobro está en el carrito)
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    for (const orderId of await pedidosDelCobro(knex, payment.payment_collection_id)) {
      await deliverDigitalProductsForOrder(container, orderId)
    }
  } catch (e) {
    logger.error(`[digital-delivery] fallo resolviendo orden para payment ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
