// GET /store/hetna-perfil-unico?taller=<handle>   -> { en_linea: { slug } | null }
// GET /store/hetna-perfil-unico?slug=<slug>       -> { tienda: { handle } | null }
// Liga el perfil de la tienda con el cotizador en línea del mismo taller.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { enLineaDeVendedor, tiendaDeSlug } from "../../../lib/perfil-unico"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const q = (req.query || {}) as Record<string, string>
  res.setHeader("Cache-Control", "public, max-age=300")
  if (q.taller) return res.json({ en_linea: await enLineaDeVendedor(knex, String(q.taller)).catch(() => null) })
  if (q.slug) return res.json({ tienda: await tiendaDeSlug(knex, String(q.slug)).catch(() => null) })
  return res.json({})
}
