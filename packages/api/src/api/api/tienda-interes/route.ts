import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorInteres, guardarInteres } from "../../../lib/interes-tienda"

// POST /api/tienda-interes — desde hetnacnc.com/mx/tienda:
//   { tipo: "avisame", categoria, contacto }       "Avísame" en una categoría Próximamente
//   { tipo: "busqueda_cotizar", termino }           cotizar algo que la búsqueda no encontró
// Todo se queda dentro de HETNA (lib/interes-tienda.ts).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const ip = String(
      req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.ip || ""
    ).trim()
    res.json(await guardarInteres(knex, req.body, ip))
  } catch (e) {
    if (e instanceof ErrorInteres) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").warn(`[tienda-interes] ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo guardar. Intenta de nuevo en un momento." })
  }
}
