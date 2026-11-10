// Cada mañana: el Radar corre sus búsquedas web (rotando, con tope diario) y
// guarda oportunidades CNC para revisar en Admin → Social Hub → Radar.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrRadar } from "../lib/radar"

export default async function radarDiario(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await correrRadar(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[radar] fallo: ${(e as Error).message}`)
  }
}

export const config = { name: "radar-diario", schedule: "13 11 * * *" }
