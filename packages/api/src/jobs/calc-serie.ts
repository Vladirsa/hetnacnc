import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrSerieCalc, serieCalcApagada } from "../lib/calc-correos"

// Seguimiento para quien pidió sus parámetros en la Calculadora CNC y aceptó
// recibir consejos: tres consejos de su proceso a los 3 días y la app para
// talleres a la semana. Reglas en lib/calc-correos.ts. CALC_SERIE=off los apaga.
export default async function calcSerie(container: MedusaContainer) {
  if (serieCalcApagada() || !process.env.RESEND_API_KEY) return
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const r = await correrSerieCalc(knex, logger)
    if (r.calc_consejo + r.calc_app || r.omitidos)
      logger.info(`[calc-serie] enviados: consejos ${r.calc_consejo}, app ${r.calc_app}; omitidos por frecuencia ${r.omitidos}`)
  } catch (e) {
    logger.error(`[calc-serie] falló la corrida: ${(e as Error).message}`)
  }
}

export const config = {
  name: "calc-serie",
  // 11:07 en Ciudad de México, después de los correos del CAM (10:57): comparten el tope diario.
  schedule: "7 17 * * *",
}
