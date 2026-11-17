import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estadoRequisitos } from "../lib/requisitos-vendedor"
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
      fields: ["id", "title", "description", "handle", "thumbnail", "images.url", "metadata", "sellers.id"],
      filters: { id: event.data.id },
    })

    if (!product?.thumbnail && !product?.images?.length) {
      // Sin imagen no hay nada que publicar en redes.
      return
    }

    // Los productos importados de distribuidores (Admin › Importar productos)
    // no se anuncian uno por uno: con 200 se llenarían las redes
    if ((product.metadata as Record<string, unknown> | null)?.importado === true) return

    // Con el alta automática ya nadie revisa al taller antes de publicar: sus
    // productos salen en las redes sólo si verificó su tarjeta (o es de
    // HETNA); si no, quedan en borrador para que HETNA los apruebe.
    let verificado = false
    const sellerId = ((product as any).sellers || [])[0]?.id
    if (sellerId) {
      const { data: [vendedor] } = await query.graph({ entity: "seller", fields: ["id", "email", "metadata"], filters: { id: sellerId } })
      const e = vendedor ? estadoRequisitos(vendedor) : null
      verificado = !!e && (e.exento || e.tarjeta.ok)
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
      logger,
      { revision: !verificado }
    )
    // El aviso a n8n también sólo para talleres verificados (n8n puede publicarlo solo)
    if (!webhookUrl || !verificado) return

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
