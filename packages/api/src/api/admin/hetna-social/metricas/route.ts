// GET /admin/hetna-social/metricas?dias=30 -> resultados por red, comunidad y publicación.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { metricas } from "../../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const dias = Number((req.query as any)?.dias) || 30
  res.json(await metricas(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), dias))
}
