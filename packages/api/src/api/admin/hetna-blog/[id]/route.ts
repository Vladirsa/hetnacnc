// GET    /admin/hetna-blog/:id
// POST   /admin/hetna-blog/:id   actualizar (sólo los campos que lleguen)
// DELETE /admin/hetna-blog/:id
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerArticulo, servicioBlog } from "../../../../lib/blog"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const [articulo] = await servicioBlog(req.scope).listLearningArticles({ id: String(req.params.id) }, { take: 1 })
  if (!articulo) return res.status(404).json({ message: "Artículo no encontrado." })
  res.json({ articulo })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const blog = servicioBlog(req.scope)
  const id = String(req.params.id)
  const [actual] = await blog.listLearningArticles({ id }, { take: 1 })
  if (!actual) return res.status(404).json({ message: "Artículo no encontrado." })
  const b = (req.body || {}) as Record<string, unknown>
  const { datos, error } = leerArticulo(b, true)
  if (error || !datos) return res.status(400).json({ message: error })
  // Volver a publicar no cambia la fecha original de publicación.
  if (b.publicado === true && actual.published_at) delete datos.published_at
  if (datos.slug && datos.slug !== actual.slug) {
    const [otro] = await blog.listLearningArticles({ slug: datos.slug as string }, { take: 1 })
    if (otro) return res.status(409).json({ message: "Ya hay otro artículo con ese slug." })
  }
  const articulo = await blog.updateLearningArticles({ id, ...datos } as any)
  res.json({ articulo })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  await servicioBlog(req.scope).softDeleteLearningArticles(String(req.params.id))
  res.json({ ok: true })
}
