// HETNA Panel → App → Latinoamérica (sólo administradores): pre-registros por país.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { panelLatam } from "../../../lib/latam"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    res.json(await panelLatam(knex))
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}
