// Cotiza la guía real de un pedido (no cobra nada).
//   POST /vendor/hetna-guias/:id/cotizar
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cotizarGuia, ErrorGuia } from "../../../../../lib/guias"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    res.json({ cotizacion: await cotizarGuia(req.scope, sellerId, req.params.id) })
  } catch (e) {
    if (e instanceof ErrorGuia) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[guias] cotizar ${req.params.id}: ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo cotizar con Skydropx. Intenta en un momento." })
  }
}
