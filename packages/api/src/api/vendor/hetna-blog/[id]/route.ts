// POST   /vendor/hetna-blog/:id   editar (vuelve a revisión y deja de verse hasta que se apruebe)
// DELETE /vendor/hetna-blog/:id   borrar
// Sólo sus propios artículos.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioBlog } from "../../../../lib/blog"
import { motivoParaNoPublicar, servicioTalleres } from "../../../../lib/alta-taller"
import { ErrorArticulo, MAX_PENDIENTES, leerArticuloTaller } from "../../../../lib/blog-instructores"
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
  const taller = await servicioTalleres(req.scope).retrieveSeller(sellerId).catch(() => null)
  const bloqueo = taller ? motivoParaNoPublicar(taller as any) : "Vuelve a iniciar sesión."
  if (bloqueo) return res.status(403).json({ message: bloqueo })
  try {
    const d = leerArticuloTaller((req.body || {}) as Record<string, unknown>)
    if ((articulo as any).revision !== "pendiente") {
      const pendientes = await servicioBlog(req.scope).listLearningArticles({ seller_id: sellerId, revision: "pendiente" } as any, { take: MAX_PENDIENTES, select: ["id"] })
      if (pendientes.length >= MAX_PENDIENTES) throw new ErrorArticulo(`Ya tienes ${pendientes.length} artículos esperando revisión. Cuando los revisemos podrás mandar más cambios.`)
    }
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
