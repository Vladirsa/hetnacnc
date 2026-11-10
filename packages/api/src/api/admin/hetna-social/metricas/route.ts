// GET /admin/hetna-social/metricas?dias=30 -> resultados por red, comunidad y
// publicación, más lo aprendido de las estadísticas de cada red.
// POST /admin/hetna-social/metricas -> lee ahora las estadísticas de las redes.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { metricas } from "../../../../lib/social-hub"
import { actualizarEstadisticas, aprendizaje } from "../../../../lib/social-estadisticas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const dias = Number((req.query as any)?.dias) || 30
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const [m, a] = await Promise.all([metricas(knex, dias), aprendizaje(knex, Math.max(dias, 60)).catch(() => null)])
  res.json({ ...m, aprendizaje: a })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json(await actualizarEstadisticas(knex, req.scope.resolve("logger"), 25))
}
