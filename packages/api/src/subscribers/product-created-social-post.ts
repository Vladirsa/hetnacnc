import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicacionAutomatica } from "../lib/social-hub"

export default async function productCreatedSocialPost({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const webhookUrl = process.env.N8N_PRODUCT_CREATED_WEBHOOK_URL

  try {
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "handle", "thumbnail", "images.url"],
      filters: { id: event.data.id },
    })

    if (!product?.thumbnail && !product?.images?.length) {
      // Sin imagen no hay nada que publicar en redes.
      return
    }

    const storefrontUrl = process.env.STOREFRONT_URL || "https://hetnacnc.com"

    // Fase 5A: publicación en el Social Hub (sale sola o espera visto bueno,
    // según la configuración del Admin)
    await publicacionAutomatica(
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      {
        origen: "producto",
        origen_id: product.id,
        titulo: product.title,
        resumen: String(product.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
        url: `${storefrontUrl}/mx/products/${product.handle}`,
        medios: [{ url: product.thumbnail || product.images?.[0]?.url, tipo: "imagen" }],
      },
      logger
    )
    if (!webhookUrl) return

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        title: product.title,
        description: product.description,
        image_url: product.thumbnail || product.images?.[0]?.url,
        product_url: `${storefrontUrl}/mx/products/${product.handle}`,
      }),
    })

    logger.info(`[social-post] aviso de producto ${product.id} enviado a n8n (status ${res.status})`)
  } catch (e) {
    logger.error(`[social-post] fallo para producto ${event.data.id}: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
