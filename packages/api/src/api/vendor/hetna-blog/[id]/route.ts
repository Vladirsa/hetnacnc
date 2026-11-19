// POST   /vendor/hetna-blog/:id   editar (vuelve a revisión y deja de verse hasta que se apruebe)
// DELETE /vendor/hetna-blog/:id   borrar
// Sólo sus propios artículos.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioBlog } from "../../../../lib/blog"
import { ErrorArticulo, leerArticuloTaller } from "../../../../lib/blog-instructores"
import { recalcularSinFallar } from "../../../../lib/comision-autores"
import { sellerDe } from "../route"

async function propio(req: AuthenticatedMedusaRequest) {
  const sellerId = sellerDe(req)
  if (!sellerId) return { sellerId: null, articulo: null }
  const [articulo] = await servicioBlog(req.scope).listLearningArticles({ id: String(req.params.id), seller_id: sellerId } as any, { take: 1 })
  return { sellerId, articulo }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId, articulo } = await propio(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  if (!articulo) return res.status(404).json({ message: "Artículo no encontrado." })
  try {
    const d = leerArticuloTaller((req.body || {}) as Record<string, unknown>)
    // Lo que se ve en el sitio debe ser lo que HETNA aprobó: al editar se
    // oculta y vuelve a revisión. La dirección (slug) no cambia.
    await servicioBlog(req.scope).updateLearningArticles({
      id: articulo.id,
      title: d.title,
      excerpt: d.excerpt,
      content_html: d.content_html,
      texto_original: d.texto,
      categoria: d.categoria,
      cover_image_url: d.cover_image_url,
      revision: "pendiente",
      motivo_revision: null,
      published_at: null,
    } as any)
    await recalcularSinFallar(req.scope, sellerId)
    res.json({ articulo: { id: articulo.id, estado: "pendiente" } })
  } catch (e) {
    if (e instanceof ErrorArticulo) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[blog-taller] editar ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar el artículo. Intenta de nuevo." })
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId, articulo } = await propio(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  if (!articulo) return res.status(404).json({ message: "Artículo no encontrado." })
  await servicioBlog(req.scope).softDeleteLearningArticles(articulo.id)
  await recalcularSinFallar(req.scope, sellerId)
  res.json({ ok: true })
}
