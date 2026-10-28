// Verificación del taller (/seller > Verificación).
//   GET -> estado, documentos subidos y qué falta
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerExpediente, vistaTaller } from "../../../lib/verificacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  res.json(vistaTaller(await leerExpediente(req.scope, sellerId)))
}
