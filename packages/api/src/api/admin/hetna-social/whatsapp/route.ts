// GET  /admin/hetna-social/whatsapp -> conexión, verificados, bajas
// POST /admin/hetna-social/whatsapp { accion: "qr" }      -> QR para reconectar el WhatsApp de HETNA
//                                   | { accion: "webhook" } -> que los mensajes que llegan pasen al sistema
//                                   | { accion: "prueba", numero } -> mensaje de prueba
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { configurarWebhook, enviarTexto, normalizarNumero, qrConexion, resumenWhatsapp } from "../../../../lib/whatsapp"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await resumenWhatsapp(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b: any = req.body || {}
  try {
    if (b.accion === "qr") return res.json(await qrConexion())
    if (b.accion === "webhook") return res.json(await configurarWebhook())
    if (b.accion === "prueba") {
      const n = normalizarNumero(String(b.numero || ""))
      if (!n) return res.status(400).json({ message: "Escribe un celular de México a 10 dígitos." })
      await enviarTexto(n, "✓ Prueba del WhatsApp de HETNA CNC: ya se pueden mandar avisos desde el sistema.")
      return res.json({ ok: true })
    }
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
