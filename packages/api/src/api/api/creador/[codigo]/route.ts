import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { creadorPublico, registrarVisita } from "../../../../lib/creadores"

// GET  /api/creador/<código> → { codigo, nombre, red, canal_url, mensaje, dias } o 404.
// POST /api/creador/<código> → cuenta una visita a su página (sin datos personales).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const c = await creadorPublico(knex, String(req.params.codigo || ""))
    if (!c) return res.status(404).json({ message: "Código no encontrado." })
    res.setHeader("Cache-Control", "public, max-age=300")
    res.json(c)
  } catch (e) {
    req.scope.resolve("logger").warn(`[creador] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo revisar el código." })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await registrarVisita(knex, String(req.params.codigo || ""))
  } catch {}
  res.json({ ok: true })
}
