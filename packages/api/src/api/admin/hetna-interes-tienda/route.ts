import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resumenInteres } from "../../../lib/interes-tienda"

// GET /admin/hetna-interes-tienda — qué stock conseguir primero:
//   personas que pidieron "Avísame" por categoría vacía y cotizaciones
//   iniciadas desde una búsqueda sin resultados (con los términos).
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json(await resumenInteres(knex))
}
