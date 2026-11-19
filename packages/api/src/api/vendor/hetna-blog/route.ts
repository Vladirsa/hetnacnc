// Panel del taller > Blog: los instructores escriben artículos de innovación
// o conocimiento. HETNA los revisa antes de publicarlos y cada artículo
// aprobado baja la comisión de sus cursos (lib/comision-autores.ts).
//   GET  /vendor/hetna-blog   -> { articulos, comision, reglas }
//   POST /vendor/hetna-blog   { titulo, texto, resumen?, categoria?, portada_url? } -> { articulo }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioTalleres, motivoParaNoPublicar } from "../../../lib/alta-taller"
import { servicioBlog } from "../../../lib/blog"
import { ErrorArticulo, MAX_LETRAS, MAX_PENDIENTES, MIN_LETRAS, leerArticuloTaller, slugTaller } from "../../../lib/blog-instructores"
import { type ResumenAutor, resumenComision } from "../../../lib/comision-autores"

type Ctx = { seller_id?: string } | undefined
export const sellerDe = (req: AuthenticatedMedusaRequest) =>
  (req as unknown as { seller_context?: Ctx }).seller_context?.seller_id

export const CAMPOS_TALLER = [
  "id", "slug", "title", "excerpt", "categoria", "cover_image_url", "texto_original", "revision", "motivo_revision",
  "published_at", "aprobado_at", "created_at", "updated_at",
]

/** Estado para el panel: borrador no existe; pendiente, rechazado o publicado. */
export const estadoDe = (a: { revision?: string | null; published_at?: unknown }) =>
  a.revision === "pendiente" ? "pendiente" : a.revision === "rechazado" ? "rechazado" : a.published_at ? "publicado" : "oculto"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = sellerDe(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const articulos = await servicioBlog(req.scope).listLearningArticles({ seller_id: sellerId } as any, {
    take: 200,
    order: { created_at: "DESC" },
    select: CAMPOS_TALLER,
  })
  let comision: ResumenAutor | null = null
  try {
    comision = await resumenComision(req.scope, sellerId)
  } catch (e) {
    req.scope.resolve("logger").warn(`[blog-taller] comisión ${sellerId}: ${(e as Error).message}`)
  }
  res.json({
    articulos: articulos.map((a: any) => ({ ...a, estado: estadoDe(a) })),
    comision,
    reglas: { min_letras: MIN_LETRAS, max_letras: MAX_LETRAS, max_pendientes: MAX_PENDIENTES },
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = sellerDe(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const taller = await servicioTalleres(req.scope).retrieveSeller(sellerId).catch(() => null)
  if (!taller) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const bloqueo = motivoParaNoPublicar(taller as any)
  if (bloqueo) return res.status(403).json({ message: bloqueo })
  try {
    const d = leerArticuloTaller((req.body || {}) as Record<string, unknown>)
    const blog = servicioBlog(req.scope)
    const pendientes = await blog.listLearningArticles({ seller_id: sellerId, revision: "pendiente" } as any, { take: MAX_PENDIENTES + 1, select: ["id"] })
    if (pendientes.length >= MAX_PENDIENTES) {
      throw new ErrorArticulo(`Ya tienes ${pendientes.length} artículos esperando revisión. Cuando los revisemos podrás mandar más.`)
    }
    const [repetido] = await blog.listLearningArticles({ slug: slugTaller(d.title, false) }, { take: 1, withDeleted: true, select: ["id"] })
    const crear = (slug: string) => blog.createLearningArticles({
      slug,
      title: d.title,
      excerpt: d.excerpt,
      content_html: d.content_html,
      texto_original: d.texto,
      categoria: d.categoria,
      cover_image_url: d.cover_image_url,
      autor: String((taller as any).name || "Taller HETNA").slice(0, 80),
      seller_id: sellerId,
      source: "taller",
      revision: "pendiente",
      published_at: null,
      guia: false,
    } as any)
    // si dos guardados con el mismo título chocan en el slug, otro con sufijo
    const articulo = await crear(slugTaller(d.title, Boolean(repetido))).catch((e) =>
      /unique|duplicate/i.test(String(e?.message)) ? crear(slugTaller(d.title, true)) : Promise.reject(e)
    )
    res.status(201).json({ articulo: { id: (articulo as any).id, estado: "pendiente" } })
  } catch (e) {
    if (e instanceof ErrorArticulo) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[blog-taller] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar el artículo. Intenta de nuevo." })
  }
}
