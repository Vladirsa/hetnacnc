import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"

import { sendDigitalDownloadEmailWorkflow } from "../workflows/send-digital-download-email"

// Logica compartida por los dos disparadores posibles de entrega digital:
// order.placed (cuando el proveedor de pago autoriza y captura en el mismo
// paso) y payment.captured (cuando la captura ocurre despues, de forma
// asincrona). metadata.digital_delivery_sent_at en la orden evita que se
// mande el correo dos veces si ambos eventos terminan apuntando a la misma
// orden ya entregada.
export async function deliverDigitalProductsForOrder(
  container: MedusaContainer,
  orderId: string
): Promise<void> {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "email",
      "customer.email",
      "metadata",
      "items.id",
      "items.title",
      "items.product_id",
      "payment_collections.status",
    ],
    filters: { id: orderId },
  })

  if (!order) {
    return
  }

  // order.placed se dispara antes de autorizar el pago, asi que la mayoria
  // de las veces este guard hace que esa rama no haga nada todavia: la
  // entrega real ocurre cuando payment.captured llega despues. "completed"
  // es el estado de payment_collections.status para una captura total
  // (el campo conveniente order.payment_status de OrderDetailDTO no se
  // puede pedir via query.graph en la entidad "order" generica).
  const paymentCollections = order.payment_collections || []
  const isPaid = paymentCollections.some(
    (pc: any) => pc?.status === "completed" || pc?.status === "partially_captured"
  )
  if (!isPaid) {
    return
  }

  const orderMetadata = (order.metadata || {}) as Record<string, unknown>
  if (orderMetadata.digital_delivery_sent_at) {
    return
  }

  const recipient = order.email || order.customer?.email
  if (!recipient) {
    return
  }

  const productIds = [
    ...new Set((order.items || []).map((item: any) => item.product_id).filter(Boolean)),
  ]
  if (productIds.length === 0) {
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata"],
    filters: { id: productIds },
  })

  let sentAny = false

  for (const item of order.items || []) {
    if (!item) {
      continue
    }

    const product = products.find((p: any) => p.id === item.product_id)
    const metadata = (product?.metadata || {}) as Record<string, unknown>

    if (metadata.producto_digital !== true || !metadata.archivo_storage_key) {
      continue
    }

    await sendDigitalDownloadEmailWorkflow(container).run({
      input: {
        to: recipient,
        product_title: (product?.title || item.title || "") as string,
        storage_key: metadata.archivo_storage_key as string,
      },
    })

    sentAny = true
    logger.info(
      `[digital-delivery] procesado para ${recipient}, SKU ${metadata.digital_factory_sku}, orden ${order.id}`
    )
  }

  if (sentAny) {
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModuleService.updateOrders(order.id, {
      metadata: {
        ...orderMetadata,
        digital_delivery_sent_at: new Date().toISOString(),
      },
    })
  }
}
