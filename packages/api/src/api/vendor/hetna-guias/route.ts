// Panel del taller > Guías: pedidos con Envíos HETNA y el estado de su guía.
//   GET /vendor/hetna-guias
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guiasListas, listarParaPanel } from "../../../lib/guias"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  if (!guiasListas()) return res.json({ activo: false, pedidos: [] })
  try {
    res.json({ activo: true, pedidos: await listarParaPanel(req.scope, sellerId) })
  } catch (e) {
    req.scope.resolve("logger").error(`[guias] lista del taller ${sellerId}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudieron leer tus pedidos." })
  }
}
