// DELETE /vendor/hetna-promocion/videos/:id -> el taller retira su video (y su autorización).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { retirarVideo } from "../../../../../lib/promocion"

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const ok = await retirarVideo(req.scope, sellerId, String(req.params.id))
  if (!ok) return res.status(404).json({ message: "Video no encontrado." })
  res.json({ ok: true })
}
