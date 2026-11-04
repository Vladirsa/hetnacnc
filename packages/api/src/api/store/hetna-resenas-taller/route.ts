// GET /store/hetna-resenas-taller?taller=<handle>
// Reseñas públicas de un taller: sólo de trabajos pagados y entregados en HETNA.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resenasPublicas } from "../../../lib/licitacion-extra"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const handle = String((req.query as any)?.taller || "").trim().slice(0, 120)
  if (!/^[a-z0-9-]{2,120}$/i.test(handle)) return res.json({ resenas: [], promedio: null, total: 0 })
  const v = await knex("seller").where({ handle }).first("id")
  if (!v) return res.json({ resenas: [], promedio: null, total: 0 })
  const resenas: Awaited<ReturnType<typeof resenasPublicas>> = await resenasPublicas(knex, v.id, 30).catch(() => [])
  const total = resenas.length
  const promedio = total ? Math.round((resenas.reduce((a: number, r: { promedio: number }) => a + Number(r.promedio), 0) / total) * 10) / 10 : null
  res.setHeader("Cache-Control", "public, max-age=300")
  return res.json({ resenas, promedio, total })
}
