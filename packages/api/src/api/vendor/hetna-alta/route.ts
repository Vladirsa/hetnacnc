// Estado de alta del taller, para el aviso de Mi tablero (lib/alta-taller.ts).
//   GET /vendor/hetna-alta -> { estado, correo_confirmado, correo, puede_publicar, mensaje }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { correoConfirmado, motivoParaNoPublicar, servicioTalleres } from "../../../lib/alta-taller"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const t = await servicioTalleres(req.scope).retrieveSeller(sellerId)
  const mensaje = motivoParaNoPublicar(t)
  res.json({
    estado: t.status,
    correo_confirmado: correoConfirmado(t),
    correo: t.email || "",
    puede_publicar: !mensaje,
    mensaje,
  })
}
