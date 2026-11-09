// GET/POST /admin/hetna-social/config -> redes activas, qué sale solo y horario.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarConfig, leerConfig } from "../../../../lib/social-hub"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await leerConfig(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await guardarConfig(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), (req.body || {}) as any))
}
