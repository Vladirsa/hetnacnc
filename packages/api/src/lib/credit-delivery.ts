import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"

import { grantCreditsWorkflow } from "../workflows/grant-credits"

// Mismo patron que digital-delivery.ts: dos disparadores posibles
// (order.placed / payment.captured), metadata.creditos_otorgados_en en la
// orden evita acreditar dos veces. Un producto es "paquete de creditos" si
// tiene metadata.producto_creditos_3d === true y metadata.creditos_otorgados
// (numero) -- se crean como productos normales del catalogo, sin modulo
// nuevo para eso.
export async function grantCreditsForOrder(container: MedusaContainer, orderId: string): Promise<void> {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "metadata",
      "items.id",
      "items.title",
      "items.product_id",
      "items.quantity",
      "payment_collections.status",
    ],
    filters: { id: orderId },
  })

  if (!order || !order.customer_id) {
    return
  }

  const paymentCollections = order.payment_collections || []
  const isPaid = paymentCollections.some(
    (pc: any) => pc?.status === "completed" || pc?.status === "partially_captured"
  )
  if (!isPaid) {
    return
  }

  const orderMetadata = (order.metadata || {}) as Record<string, unknown>
  if (orderMetadata.creditos_otorgados_en) {
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

  let grantedAny = false

  for (const item of order.items || []) {
    if (!item) {
      continue
    }

    const product = products.find((p: any) => p.id === item.product_id)
    const metadata = (product?.metadata || {}) as Record<string, unknown>
    const creditosPorUnidad = Number(metadata.creditos_otorgados)

    if (metadata.producto_creditos_3d !== true || !creditosPorUnidad) {
      continue
    }

    const cantidadTotal = creditosPorUnidad * (Number(item.quantity) || 1)

    await grantCreditsWorkflow(container).run({
      input: {
        customer_id: order.customer_id,
        amount: cantidadTotal,
        type: "compra",
        reference_id: order.id,
        description: `Compra: ${product?.title || item.title || "paquete de créditos"}`,
      },
    })

    grantedAny = true
    logger.info(
      `[credit-delivery] ${cantidadTotal} créditos acreditados a customer ${order.customer_id}, orden ${order.id}`
    )
  }

  if (grantedAny) {
    const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModuleService.updateOrders(order.id, {
      metadata: {
        ...orderMetadata,
        creditos_otorgados_en: new Date().toISOString(),
      },
    })
  }
}
