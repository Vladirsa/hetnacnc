// HETNA Panel → Distribuidores (sólo administradores).
//   GET  /admin/hetna-distribuidores → { instalado, codigos, meses_a_favor, referidos, solicitudes }
//   POST /admin/hetna-distribuidores { accion: crear|activar|desactivar|mes_aplicado|crear_para_solicitud|descartar, ... }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { accionDistribuidores, accionSolicitud, ErrorDistribuidor, panelDistribuidores, solicitudesDistribuidor } from "../../../lib/distribuidores"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const [panel, solicitudes] = await Promise.all([panelDistribuidores(), solicitudesDistribuidor(knex)])
    res.json({ ...panel, solicitudes })
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    const b = req.body as any
    if (b?.accion === "crear_para_solicitud" || b?.accion === "descartar") {
      const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      return res.json(await accionSolicitud(knex, b))
    }
    res.json(await accionDistribuidores(b))
  } catch (e) {
    if (e instanceof ErrorDistribuidor) return res.status(e.status).json({ message: e.message })
    res.status(502).json({ message: `No se pudo: ${(e as Error).message}` })
  }
}
