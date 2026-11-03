// Panel del taller > Libros y PDF (lib/publicar-libro.ts)
//   GET  /vendor/hetna-libros  -> { libros, max_mb }
//   POST /vendor/hetna-libros  { titulo, autor?, descripcion?, paginas?, precio,
//                                portada_url, archivo_storage_key } -> { product_id, handle }
// El PDF se sube antes con POST /vendor/hetna-libros/archivo.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { librosDelTaller, MAX_MB_LIBRO, publicarLibro, validarLibro } from "../../../lib/publicar-libro"
import { ErrorPublicar } from "../../../lib/publicar-rapido"

type Ctx = { seller_id?: string; seller_member?: { member_id?: string } } | undefined
const contexto = (req: AuthenticatedMedusaRequest) => (req as unknown as { seller_context?: Ctx }).seller_context

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = contexto(req)?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    res.json({ libros: await librosDelTaller(req.scope, sellerId), max_mb: MAX_MB_LIBRO })
  } catch (e) {
    req.scope.resolve("logger").error(`[libros] listado ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron cargar tus libros." })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = contexto(req)
  const sellerId = ctx?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const datos = validarLibro((req.body || {}) as Record<string, unknown>, sellerId)
    const memberId = ctx?.seller_member?.member_id || req.auth_context?.actor_id
    res.json(await publicarLibro(req.scope, sellerId, memberId, datos))
  } catch (e) {
    if (e instanceof ErrorPublicar) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[libros] ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo publicar el libro. Intenta de nuevo; si sigue, avísanos por WhatsApp." })
  }
}
