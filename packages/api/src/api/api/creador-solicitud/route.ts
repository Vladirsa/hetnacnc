import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarSolicitudCreador } from "../../../lib/creadores"
import { ErrorDistribuidor } from "../../../lib/distribuidores"

// POST /api/creador-solicitud — formulario de hetnacnc.com/creadores.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const ip = String(req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.ip || "").trim()
    res.json(await guardarSolicitudCreador(knex, req.body, ip))
  } catch (e) {
    if (e instanceof ErrorDistribuidor) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").warn(`[creador-solicitud] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo enviar. Intenta de nuevo en un momento." })
  }
}
