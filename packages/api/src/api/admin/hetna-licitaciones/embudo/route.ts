// GET /admin/hetna-licitaciones/embudo?dias=30
// Resultados de licitaciones para el dashboard (lib/licitacion-embudo).
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { asegurarSeguimiento } from "../../../../lib/seguimiento"
import { asegurarAmpliar } from "../../../../lib/licitacion-ampliar"
import { embudo } from "../../../../lib/licitacion-embudo"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await asegurarSeguimiento(knex)
  await asegurarAmpliar(knex)
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30))
  res.json(await embudo(knex, dias))
}
