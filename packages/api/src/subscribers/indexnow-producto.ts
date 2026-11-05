import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ProductWorkflowEvents } from "@mercurjs/core/workflows"

import { avisarProductoIndexNow } from "../lib/indexnow"

// Producto publicado o editado -> se avisa a Bing/Copilot/ChatGPT por IndexNow
// (lib/indexnow.ts). Sólo productos publicados: un borrador no debe indexarse.
export default async function indexNowProducto({ event, container }: SubscriberArgs<{ id?: string; product_id?: string }>) {
  const id = event.data?.product_id || event.data?.id
  if (!id) return
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product", fields: ["handle", "status"], filters: { id } })
    const p = data?.[0] as { handle?: string; status?: string } | undefined
    if (p?.handle && p.status === "published") avisarProductoIndexNow(p.handle, container.resolve("logger"))
  } catch {
    /* no detiene nada */
  }
}

export const config: SubscriberConfig = {
  event: [ProductWorkflowEvents.PUBLISHED, "product.updated", "product.created"],
  context: { subscriberId: "indexnow-producto" },
}
