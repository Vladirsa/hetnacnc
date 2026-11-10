// Cada 2 minutos: la Fábrica de contenido retoma trabajos pendientes y pone
// tarjeta a las publicaciones automáticas sin imagen (lib/fabrica) y hace la
// imagen o el video de los borradores del plan semanal (plan-material).
import { MedusaContainer } from "@medusajs/framework/types"

import { procesarCola, tarjetasAutomaticas } from "../lib/fabrica"
import { materialPlan } from "../lib/fabrica/plan-material"

export default async function fabricaCola(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await tarjetasAutomaticas(container, logger)
    await procesarCola(container, logger)
    await materialPlan(container, logger)
  } catch (e) {
    logger.error(`[fabrica] cola: ${(e as Error).message}`)
  }
}

export const config = { name: "fabrica-cola", schedule: "*/2 * * * *" }
