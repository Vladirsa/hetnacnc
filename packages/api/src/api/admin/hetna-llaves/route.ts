// GET /admin/hetna-llaves — qué funciones del servidor usa cada clave API
// (n8n, bot de WhatsApp). Sólo lectura; ver lib/llaves-uso.ts.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { usoDeLlaves } from "../../../lib/llaves-uso"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ llaves: await usoDeLlaves(knex) })
}
