// Cada lunes 9:07 (centro de México): recicla lo que mejor funcionó y manda el
// resumen de la semana por Telegram (y correo).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { lunesSocial } from "../lib/social-semanal"
import { renovarThreads } from "../lib/threads"

export default async function socialHubLunes(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await renovarThreads(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
    await lunesSocial(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[social] lunes: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-lunes", schedule: "7 15 * * 1" }
