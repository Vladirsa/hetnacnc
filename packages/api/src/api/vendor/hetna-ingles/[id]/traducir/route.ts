// Panel del taller > Productos en inglés: propuesta de traducción con IA.
//   POST /vendor/hetna-ingles/:id/traducir -> { en } (no se guarda: el taller la revisa y guarda)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { contarSugerencia, ErrorIngles, sugerirIngles } from "../../../../../lib/productos-ingles"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    contarSugerencia(sellerId)
    res.json({ en: await sugerirIngles(req.scope, sellerId, req.params.id) })
  } catch (e) {
    if (e instanceof ErrorIngles) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[ingles] sugerencia ${sellerId} ${req.params.id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo traducir. Intenta de nuevo." })
  }
}
