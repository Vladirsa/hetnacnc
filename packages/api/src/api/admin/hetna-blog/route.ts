// GET  /admin/hetna-blog          todos los artículos (también borradores)
// POST /admin/hetna-blog          crear { title, content_html, excerpt?, categoria?, guia?, publicado?, ... }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerArticulo, servicioBlog } from "../../../lib/blog"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const [articulos, total] = await servicioBlog(req.scope).listAndCountLearningArticles(
    {},
    { take: 200, order: { created_at: "DESC" } }
  )
  res.json({ articulos, total })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { datos, error } = leerArticulo((req.body || {}) as Record<string, unknown>)
  if (error || !datos) return res.status(400).json({ message: error })
  const blog = servicioBlog(req.scope)
  const [existe] = await blog.listLearningArticles({ slug: datos.slug as string }, { take: 1 })
  if (existe) return res.status(409).json({ message: "Ya hay un artículo con esa dirección (slug). Cambia el título o el slug." })
  const articulo = await blog.createLearningArticles({ source: "blog", ...datos } as any)
  res.status(201).json({ articulo })
}
