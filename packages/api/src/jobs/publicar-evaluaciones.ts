// Cada día: publica las evaluaciones (Trust & Ranking) que llevan 14 días
// esperando a que la otra parte evalúe. Ver lib/trust.ts.
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { publicarVencidas } from "../lib/trust"

export default async function publicarEvaluaciones(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await publicarVencidas(knex, logger)
  } catch (e) {
    logger.error(`[trust] no se pudieron publicar evaluaciones vencidas: ${(e as Error).message}`)
  }
}

export const config = {
  name: "publicar-evaluaciones",
  schedule: "17 9 * * *",
}
