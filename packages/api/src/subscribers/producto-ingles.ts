// Traduce solo al inglés cada producto nuevo o cuyo texto en español cambió
// (lib/productos-ingles.ts > traducirSiHaceFalta). Usa la IA del sistema
// (ANTHROPIC_API_KEY); con INGLES_IA=off no hace nada.
// No pisa el inglés que el taller escribió a mano, y no se repite: guarda la
// huella del español (en_hash) y si no cambió, no vuelve a traducir. Por eso
// escuchar también product.updated (que dispara su propio guardado) no da vueltas.
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { traducirSiHaceFalta } from "../lib/productos-ingles"

// Mismo producto guardado varias veces seguidas (formulario del panel): una sola traducción a la vez.
const enCurso = new Set<string>()

export default async function productoIngles({ event, container }: SubscriberArgs<{ id: string }>) {
  const id = event.data?.id
  if (!id || enCurso.has(id)) return
  enCurso.add(id)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const r = await traducirSiHaceFalta(container, id)
    if (r === "traducido") logger.info(`[ingles] producto ${id} traducido al inglés`)
  } catch (e) {
    logger.warn(`[ingles] no se pudo traducir el producto ${id}: ${(e as Error).message}`)
  } finally {
    enCurso.delete(id)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
  context: { subscriberId: "producto-ingles" },
}
