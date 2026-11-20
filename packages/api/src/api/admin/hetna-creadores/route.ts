// HETNA Panel → App → Creadores (sólo administradores).
//   GET  /admin/hetna-creadores → { creadores, solicitudes }
//   POST /admin/hetna-creadores { accion: crear|crear_para_solicitud|descartar|activar|pausar|premio, ... }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { accionCreadores, panelCreadores } from "../../../lib/creadores"
import { ErrorDistribuidor } from "../../../lib/distribuidores"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    res.json(await panelCreadores(knex))
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    res.json(await accionCreadores(knex, req.body))
  } catch (e) {
    if (e instanceof ErrorDistribuidor) return res.status(e.status).json({ message: e.message })
    res.status(502).json({ message: `No se pudo: ${(e as Error).message}` })
  }
}
