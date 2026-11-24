// Cada 15 minutos: solicitudes que llevan 2 h sin propuesta → recordatorio a
// los talleres y aviso a HETNA por Telegram. Ver lib/respuesta-rapida.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarTablas } from "../lib/licitacion"
import { correrRespuestaRapida } from "../lib/respuesta-rapida"

export default async function respuestaRapida(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurarTablas(knex)
    await correrRespuestaRapida(knex, logger)
  } catch (e) {
    logger.error(`[respuesta-rapida] falló: ${(e as Error).message}`)
  }
}

export const config = {
  name: "respuesta-rapida",
  schedule: "*/15 * * * *",
}
