// POST /vendor/hetna-promocion/videos (multipart: archivo + descripcion, solicitud_id, autorizo)
// El taller sube un video de su trabajo con autorización expresa para que HETNA lo publique.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { subirVideo } from "../../../../lib/promocion"
import { ipDe } from "../../../../lib/safedeal-http"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const archivo = ((req as any).files?.archivo || [])[0]
  try {
    res.json({ ok: true, ...(await subirVideo(req.scope, sellerId, archivo, req.body || {}, ipDe(req))) })
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo guardar el video. Intenta de nuevo." })
  }
}
