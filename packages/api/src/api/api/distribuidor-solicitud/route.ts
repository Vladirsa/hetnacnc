import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorDistribuidor, guardarSolicitudDistribuidor } from "../../../lib/distribuidores"

// POST /api/distribuidor-solicitud — formulario de hetnacnc.com/distribuidores.
// Guarda la solicitud dentro de HETNA (panel → Referidos y distribuidores).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const ip = String(req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.ip || "").trim()
    res.json(await guardarSolicitudDistribuidor(knex, req.body, ip))
  } catch (e) {
    if (e instanceof ErrorDistribuidor) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").warn(`[distribuidor-solicitud] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo enviar. Intenta de nuevo en un momento." })
  }
}
