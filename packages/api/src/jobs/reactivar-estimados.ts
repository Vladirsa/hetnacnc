// Cada día: seguimiento a quien pidió un precio al instante en /cotizar y no
// mandó su solicitud (días 2 y 7) y aviso a Telegram de los estimados grandes.
// Ver lib/estimados.ts
import { MedusaContainer } from "@medusajs/framework/types"

import { correrReactivador } from "../lib/estimados"

export default async function reactivarEstimadosJob(container: MedusaContainer) {
  if (!process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  try {
    const r = await correrReactivador(container)
    if (r.correos || r.cerrados || r.fallidos || r.avisados)
      logger.info(`[estimados] correos ${r.correos}, cerrados ${r.cerrados}, fallidos ${r.fallidos}, grandes avisados ${r.avisados}`)
  } catch (e) {
    logger.error(`[estimados] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "reactivar-estimados",
  // 12:13 en Ciudad de México
  schedule: "13 18 * * *",
}
