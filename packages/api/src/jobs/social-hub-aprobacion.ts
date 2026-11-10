// Cada hora (minuto 31): a la hora configurada manda por Telegram los
// borradores del día para aprobarlos desde el celular.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisoDiario } from "../lib/social-telegram"

export default async function socialHubAprobacion(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    await avisoDiario(container.resolve(ContainerRegistrationKeys.PG_CONNECTION), logger)
  } catch (e) {
    logger.error(`[social] aviso por Telegram: ${(e as Error).message}`)
  }
}

export const config = { name: "social-hub-aprobacion", schedule: "31 * * * *" }
