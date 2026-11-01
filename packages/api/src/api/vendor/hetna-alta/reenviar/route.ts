// Botón "Reenviar la liga" del aviso de Mi tablero.
//   POST /vendor/hetna-alta/reenviar
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { correoConfirmado, mandarConfirmacion, servicioTalleres } from "../../../../lib/alta-taller"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const t = await servicioTalleres(req.scope).retrieveSeller(sellerId)
  if (correoConfirmado(t)) return res.json({ ok: true, ya: true })
  const r = await mandarConfirmacion(t)
  if (!r.sent && r.reason?.includes("minuto")) {
    return res.status(429).json({ message: "Ya te la mandamos hace un momento. Espera un minuto y revisa también spam." })
  }
  if (!r.sent) return res.status(503).json({ message: "No se pudo mandar el correo. Intenta más tarde o escríbenos por WhatsApp." })
  res.json({ ok: true, correo: t.email })
}
