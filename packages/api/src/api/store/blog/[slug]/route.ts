// GET /store/blog/:slug   un artículo publicado, con otros de su sección.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioBlog } from "../../../../lib/blog"
import { CAMPOS_LISTA } from "../route"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const blog = servicioBlog(req.scope)
  const [articulo] = await blog.listLearningArticles(
    { slug: String(req.params.slug), published_at: { $ne: null } },
    { take: 1 }
  )
  if (!articulo) return res.status(404).json({ message: "Artículo no encontrado." })
  // Campos internos de la revisión de instructores: no salen al público.
  const { revision, motivo_revision, texto_original, aprobado_at, seller_id, ...publico } = articulo as any
  void revision; void motivo_revision; void texto_original; void aprobado_at; void seller_id
  const relacionados = await blog.listLearningArticles(
    { published_at: { $ne: null }, id: { $ne: articulo.id }, ...(articulo.categoria ? { categoria: articulo.categoria } : {}) },
    { take: 4, order: { published_at: "DESC" }, select: CAMPOS_LISTA }
  )
  res.json({ articulo: publico, relacionados })
}
