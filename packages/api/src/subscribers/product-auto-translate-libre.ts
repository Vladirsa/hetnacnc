import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function productAutoTranslateLibre({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const remoteQuery = container.resolve("remoteQuery")

  try {
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "metadata"],
      filters: { id: event.data.id },
    })

    if (!product || product.metadata?.translations?.en) {
      return
    }

    logger.info(`[auto-translate-libre] Traduciendo producto ${product.id}`)

    const libreUrl = process.env.LIBRE_TRANSLATE_URL || "https://libretranslate.de"

    // Traducir título y descripción
    const title_en = await translateText(product.title, libreUrl, logger)
    const description_en = await translateText(product.description || "", libreUrl, logger)

    const metadata = product.metadata || {}
    metadata.translations = {
      ...(metadata.translations || {}),
      en: {
        title: title_en,
        description: description_en,
      },
    }

    await remoteQuery.mutation({
      entity: "product",
      action: "update",
      variables: { id: product.id, metadata },
    })

    logger.info(`[auto-translate-libre] Producto ${product.id} traducido exitosamente`)
  } catch (e) {
    logger.error(`[auto-translate-libre] Error: ${e}`)
  }
}

async function translateText(
  text: string,
  url: string,
  logger: any
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return ""
  }

  try {
    const response = await fetch(`${url}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "es",
        target: "en",
      }),
    })

    if (!response.ok) {
      logger.warn(`[auto-translate-libre] API error: ${response.statusText}`)
      return text
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (e) {
    logger.warn(`[auto-translate-libre] Translation failed: ${e}`)
    return text
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
