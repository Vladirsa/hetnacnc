// Panel del taller > Precios de materiales (lib/materiales-precios.ts)
//   GET /vendor/hetna-materiales -> { materiales: [...] } con mediana, mínimo, máximo,
//   promedio, cambio, precio por m² o por gramo, serie para la gráfica y tiendas.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { estadisticasEnCache } from "../../../lib/materiales-precios"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ materiales: await estadisticasEnCache(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)) })
}
