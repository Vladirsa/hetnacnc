// Los ajustes de precio del dueño, para la calculadora del navegador
// (/cotizar y "Fabrícalo con un taller"). Sólo números de tarifas: nada privado.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerConfigPrecios } from "../../../lib/precios-config"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { cfg } = await leerConfigPrecios(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION))
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json({ cfg })
}
