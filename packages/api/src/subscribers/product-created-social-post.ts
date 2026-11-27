import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

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
      fields: ["id", "title", "description", "handle", "status", "thumbnail", "images.url", "metadata", "sellers.id"],
      filters: { id: event.data.id },
    })
    if (!product) return

    // Borradores (27 nov 2026): no se anuncian (la liga daría 404). Se marcan como pendientes
    // y se anuncian la primera vez que se publican (evento product.updated).
    const meta = (product.metadata || {}) as Record<string, unknown>
    if (event.name === "product.updated") {
      if (product.status !== "published" || meta.redes_pendiente !== true) return
      await (container.resolve(Modules.PRODUCT) as any).updateProducts(product.id, { metadata: { ...meta, redes_pendiente: false } })
    } else if (product.status !== "published") {
      await (container.resolve(Modules.PRODUCT) as any).updateProducts(product.id, { metadata: { ...meta, redes_pendiente: true } })
      return
    }

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
    // El vínculo producto↔taller puede crearse justo después del evento: se
    // usa metadata.seller_id (Publicar rápido) y, si no, se espera un momento
    // y se vuelve a consultar. Sin taller después de eso, lo creó HETNA desde
    // el admin (sólo un administrador puede): se trata como verificado.
    let verificado = false
    let sellerId: string | undefined =
      ((product as any).sellers || [])[0]?.id || ((product.metadata as Record<string, unknown> | null)?.seller_id as string | undefined)
    if (!sellerId) {
      await new Promise((r) => setTimeout(r, 4000))
      const { data: [otra] } = await query.graph({ entity: "product", fields: ["id", "sellers.id"], filters: { id: product.id } })
      sellerId = ((otra as any)?.sellers || [])[0]?.id
      if (!sellerId) verificado = true
    }
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
  event: ["product.created", "product.updated"],
}
