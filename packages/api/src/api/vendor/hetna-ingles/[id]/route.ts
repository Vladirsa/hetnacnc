// Panel del taller > Productos en inglés: guardar el texto en inglés de un producto
//   POST /vendor/hetna-ingles/:id { en_title, en_subtitle, en_description, en_seo_title, en_meta_description }
//   Vacío = quitar ese campo. -> { en, traduccion }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorIngles, guardarIngles, validarIngles } from "../../../../lib/productos-ingles"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const en = validarIngles((req.body || {}) as Record<string, unknown>)
    res.json(await guardarIngles(req.scope, sellerId, req.params.id, en))
  } catch (e) {
    if (e instanceof ErrorIngles) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[ingles] ${sellerId} ${req.params.id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo." })
  }
}
