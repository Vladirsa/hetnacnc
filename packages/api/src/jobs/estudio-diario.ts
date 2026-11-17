// Cada madrugada (3:23, centro de México): si el Estudio está prendido, hace el
// video del día (guion → voz → escenas con IA de video) y lo deja programado a
// la hora que mejor ha funcionado (lib/fabrica/estudio).
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerEstudioCfg, videoDelDia } from "../lib/fabrica/estudio"

export default async function estudioDiario(container: MedusaContainer) {
  const logger = container.resolve("logger")
  try {
    if (!(await leerEstudioCfg(container.resolve(ContainerRegistrationKeys.PG_CONNECTION))).activo) return
    const r = await videoDelDia(container, logger)
    if (!r.hecho) logger.info(`[estudio] hoy no: ${r.motivo}`)
  } catch (e) {
    logger.error(`[estudio] ${(e as Error).message}`)
  }
}

export const config = { name: "estudio-diario", schedule: "23 9 * * *" }
