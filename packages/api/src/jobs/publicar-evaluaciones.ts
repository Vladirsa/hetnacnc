// Cada día: publica las evaluaciones (Trust & Ranking) que llevan 14 días
// esperando a que la otra parte evalúe, y recalcula el historial medido
// (puntualidad, terminados, reclamos) de los talleres con trabajos asignados.
// Ver lib/trust.ts y lib/reputacion-medida.ts.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD } from "../lib/licitacion"
import { publicarVencidas, recalcularTaller } from "../lib/trust"

export default async function publicarEvaluaciones(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await publicarVencidas(knex, logger)
  } catch (e) {
    logger.error(`[trust] no se pudieron publicar evaluaciones vencidas: ${(e as Error).message}`)
  }
  try {
    if (!(await knex.schema.hasTable(T_SOLICITUD)) || !(await knex.schema.hasTable(T_PROPUESTA))) return
    const filas = await knex(`${T_SOLICITUD} as s`).join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida").distinct("p.seller_id")
    for (const f of filas) await recalcularTaller(knex, f.seller_id)
    logger.info(`[trust] historial medido recalculado para ${filas.length} talleres`)
  } catch (e) {
    logger.error(`[trust] no se pudo recalcular el historial medido: ${(e as Error).message}`)
  }
}

export const config = {
  name: "publicar-evaluaciones",
  schedule: "17 9 * * *",
}
