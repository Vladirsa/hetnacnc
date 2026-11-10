// Cada 2 minutos: la Fábrica de contenido retoma trabajos pendientes y pone
// tarjeta a las publicaciones automáticas sin imagen (lib/fabrica).
import { MedusaContainer } from "@medusajs/framework/types"

import { procesarCola, tarjetasAutomaticas } from "../lib/fabrica"

export default async function fabricaCola(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await tarjetasAutomaticas(container, logger)
    await procesarCola(container, logger)
  } catch (e) {
    logger.error(`[fabrica] cola: ${(e as Error).message}`)
  }
}

export const config = { name: "fabrica-cola", schedule: "*/2 * * * *" }
