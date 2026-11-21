import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { conteoLatam, ErrorLatam, registrarLatam } from "../../../lib/latam"

// GET  /api/latam-registro → { conteo: { co: { talleres, clientes }, ... } }
// POST /api/latam-registro { pais, tipo, nombre, empresa, correo, telefono, ciudad, maquinas, mensaje }
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    res.setHeader("Cache-Control", "public, max-age=300")
    res.json({ conteo: await conteoLatam(knex) })
  } catch {
    res.json({ conteo: {} })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const ip = String(req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.ip || "").trim()
    res.json(await registrarLatam(knex, req.body, ip))
  } catch (e) {
    if (e instanceof ErrorLatam) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").warn(`[latam] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo enviar. Intenta de nuevo en un momento." })
  }
}
