// Cada día (13:41, centro de México): con la Fase 4 encendida, anota la
// compensación de las entregas que llegaron tarde (lib/fase4). Apagada, no hace nada.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { revisarEntregasTarde } from "../lib/fase4"

export default async function fase4Entregas(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await revisarEntregasTarde(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[fase4] ${(e as Error).message}`)
  }
}

export const config = { name: "fase4-entregas", schedule: "41 19 * * *" }
