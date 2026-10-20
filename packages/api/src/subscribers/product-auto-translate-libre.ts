// Traducción automática del catálogo al inglés, con LibreTranslate.
//
// Cuando se crea un producto, guarda su título y descripción en inglés dentro
// de `metadata.translations.en`, para que la tienda pueda servir la ficha en
// inglés sin que nadie la escriba a mano.
//
// Es OPCIONAL y está apagado por omisión. Hay que poner LIBRE_TRANSLATE_URL
// apuntando a un LibreTranslate propio (o a uno con llave). Sin esa variable
// el subscriber se sale de inmediato, sin tocar la red ni el producto.
//
// El apagado por omisión no es precaución de más: la instancia pública
// libretranslate.de dejó de ser abierta, así que sin servidor propio cada
// producto nuevo dispararía dos peticiones que fallan. Y como `traducir`
// devuelve el texto original cuando algo falla, eso dejaría guardado en
// `translations.en` el mismo español, marcado como inglés -- y la verificación
// de "ya está traducido" impediría volver a intentarlo cuando por fin hubiera
// un traductor. Una traducción falsa es peor que ninguna: nadie se entera de
// que falta.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

// Una traducción que tarda más que esto no vale bloquear el subscriber.
const TIEMPO_LIMITE_MS = 15_000

type Traducciones = Record<string, { title?: string; description?: string }>

export default async function productAutoTranslateLibre({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const libreUrl = process.env.LIBRE_TRANSLATE_URL
  if (!libreUrl) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "metadata"],
      filters: { id: event.data.id },
    })

    if (!product) {
      return
    }

    const metadata = (product.metadata ?? {}) as Record<string, unknown>
    const traducciones = (metadata.translations ?? {}) as Traducciones

    if (traducciones.en?.title) {
      return
    }

    const titulo = await traducir(product.title, libreUrl, logger)
    // La descripción puede venir vacía: eso no es una falla, es un producto
    // sin descripción.
    const descripcion = product.description
      ? await traducir(product.description, libreUrl, logger)
      : ""

    // Si el título no se pudo traducir, no se guarda nada. Es la diferencia
    // entre "falta traducir" y "ya está traducido, en español".
    if (!titulo) {
      logger.warn(
        `[auto-translate] no se pudo traducir el producto ${product.id}; se queda sin traducción`
      )
      return
    }

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: product.id },
        update: {
          metadata: {
            ...metadata,
            translations: {
              ...traducciones,
              en: { title: titulo, description: descripcion },
            },
          },
        },
      },
    })

    logger.info(`[auto-translate] producto ${product.id} traducido al inglés`)
  } catch (e) {
    logger.error(`[auto-translate] falló la traducción del producto ${event.data.id}: ${e}`)
  }
}

// Devuelve el texto traducido, o cadena vacía si no se pudo. Nunca devuelve el
// original: quien llama necesita poder distinguir las dos cosas.
async function traducir(
  texto: string,
  url: string,
  logger: { warn: (m: string) => void }
): Promise<string> {
  if (!texto?.trim()) {
    return ""
  }

  try {
    const respuesta = await fetch(`${url.replace(/\/+$/, "")}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texto,
        source: "es",
        target: "en",
        format: "text",
        ...(process.env.LIBRE_TRANSLATE_API_KEY
          ? { api_key: process.env.LIBRE_TRANSLATE_API_KEY }
          : {}),
      }),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    })

    if (!respuesta.ok) {
      logger.warn(`[auto-translate] LibreTranslate respondió ${respuesta.status}`)
      return ""
    }

    const datos = (await respuesta.json()) as { translatedText?: string }
    return datos.translatedText?.trim() || ""
  } catch (e) {
    logger.warn(`[auto-translate] no se pudo llamar a LibreTranslate: ${e}`)
    return ""
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
