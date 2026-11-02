// Panel del taller > Ficha extendida: guardar la ficha de un producto
//   POST /vendor/hetna-ficha/:id { compatibilidad: string[], videos: string[],
//        archivos: { nombre, url }[], faq: { pregunta, respuesta }[] } -> { ficha }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorFicha, guardarFicha, validarFicha } from "../../../../lib/ficha-extendida"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  try {
    const ficha = validarFicha((req.body || {}) as Record<string, unknown>)
    res.json({ ficha: await guardarFicha(req.scope, sellerId, req.params.id, ficha) })
  } catch (e) {
    if (e instanceof ErrorFicha) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[ficha] ${sellerId} ${req.params.id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo guardar. Intenta de nuevo; si sigue, avísanos por WhatsApp." })
  }
}
