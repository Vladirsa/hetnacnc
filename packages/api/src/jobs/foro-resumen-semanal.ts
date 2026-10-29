import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { errorForo, foroCorreosListo, mandarResumenSemanal } from "../lib/foro-correos"

// Lunes a las 9:13 de la mañana (hora de México, 15:13 UTC): el resumen de la
// semana del foro a quien lo tiene activado (lo de fábrica) y tuvo actividad
// en los últimos meses. Lo que más se movió en su red, preguntas que puede
// responder, vacantes y eventos. Si no hay nada que contarle, no se manda.
export default async function foroResumenSemanal(container: MedusaContainer) {
  if (!foroCorreosListo()) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const n = await mandarResumenSemanal(knex, logger)
    logger.info(`[foro-resumen-semanal] ${n} resúmenes enviados`)
  } catch (e) {
    errorForo(logger, e, "foro-resumen-semanal")
  }
}

export const config = {
  name: "foro-resumen-semanal",
  schedule: "13 15 * * 1",
}
