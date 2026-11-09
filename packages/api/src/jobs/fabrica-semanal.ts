// Cada lunes: taller destacado de la semana, opinión de cliente y (el primer
// lunes del mes) el índice de precios CNC, como borradores con su tarjeta.
import { MedusaContainer } from "@medusajs/framework/types"

import { piezasSemanales } from "../lib/fabrica"

export default async function fabricaSemanal(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    const creadas = await piezasSemanales(container, logger)
    logger.info(`[fabrica] piezas semanales: ${creadas.join(", ") || "ninguna"}`)
  } catch (e) {
    logger.error(`[fabrica] semanal: ${(e as Error).message}`)
  }
}

export const config = { name: "fabrica-semanal", schedule: "11 14 * * 1" }
