import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { errorForo, foroCorreosListo, mandarAvisos, recordarEventos } from "../lib/foro-correos"

// Todos los días a las 8:07 de la mañana (hora de México, 14:07 UTC):
// 1. Recordatorio de los eventos de mañana a quienes dijeron "Asistiré" (queda
//    como aviso; sale por correo según lo que cada quien eligió).
// 2. El resumen del día para quien eligió "un resumen al día".
export default async function foroAvisosDiario(container: MedusaContainer) {
  if (!foroCorreosListo()) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const recordados = await recordarEventos()
    const n = await mandarAvisos(knex, "diario", logger)
    if (recordados || n) logger.info(`[foro-avisos-diario] ${recordados} recordatorios de eventos, ${n} resúmenes diarios`)
  } catch (e) {
    errorForo(logger, e, "foro-avisos-diario")
  }
}

export const config = {
  name: "foro-avisos-diario",
  schedule: "7 14 * * *",
}
