// GET /store/resenas/fotos/:id — la foto de una reseña PUBLICADA (pasó la
// moderación). La tienda la sirve en /api/resena-foto/:id con caché larga.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { leerFotoResena } from "../../../../../lib/resena-fotos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const f = await leerFotoResena(knex, String(req.params.id || "")).catch(() => null)
  if (!f) return res.status(404).json({ message: "No encontrada." })
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "review", fields: ["status"], filters: { id: f.review_id } })
    if ((data?.[0] as { status?: string } | undefined)?.status !== "published") return res.status(404).json({ message: "No encontrada." })
  } catch {
    return res.status(404).json({ message: "No encontrada." })
  }
  res.setHeader("Content-Type", f.tipo)
  res.setHeader("Cache-Control", "public, max-age=86400")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.end(f.datos)
}
