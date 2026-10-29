// GET /store/blog?categoria=diseno-cam&guia=1&limit=12&offset=0
// Artículos publicados del blog del foro, el más nuevo primero. Sin el
// contenido completo: para eso está /store/blog/:slug.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { CATEGORIAS_BLOG, servicioBlog } from "../../../lib/blog"

export const CAMPOS_LISTA = [
  "id", "slug", "title", "excerpt", "cover_image_url", "video_url", "categoria", "guia", "autor", "published_at",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = req.query as Record<string, string>
  const limite = Math.min(Math.max(Number(q.limit) || 12, 1), 50)
  const desde = Math.max(Number(q.offset) || 0, 0)
  const filtros: Record<string, unknown> = { published_at: { $ne: null } }
  if (CATEGORIAS_BLOG.includes(q.categoria)) filtros.categoria = q.categoria
  if (q.guia === "1") filtros.guia = true
  const [articulos, total] = await servicioBlog(req.scope).listAndCountLearningArticles(filtros, {
    take: limite,
    skip: desde,
    order: { guia: "DESC", published_at: "DESC" },
    select: CAMPOS_LISTA,
  })
  res.json({ articulos, total })
}
