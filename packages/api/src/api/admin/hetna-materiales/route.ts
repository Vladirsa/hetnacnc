// GET /admin/hetna-materiales -> { materiales: [...] } (estadísticas de la base de precios)
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estadisticasMateriales } from "../../../lib/materiales-precios"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ materiales: await estadisticasMateriales(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)) })
}
