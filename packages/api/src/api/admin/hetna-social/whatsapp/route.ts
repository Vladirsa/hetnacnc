// GET  /admin/hetna-social/whatsapp -> conexión, verificados, bajas
// POST /admin/hetna-social/whatsapp { accion: "qr" }      -> QR para reconectar el WhatsApp de HETNA
//                                   | { accion: "webhook" } -> que los mensajes que llegan pasen al sistema
//                                   | { accion: "prueba", numero } -> mensaje de prueba
//                                   | { accion: "bot", activo } -> respondedor automático encendido o apagado
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { activarBot, resumenBot } from "../../../../lib/whatsapp-bot"
import { configurarWebhook, enviarTexto, normalizarNumero, qrConexion, resumenWhatsapp } from "../../../../lib/whatsapp"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ ...(await resumenWhatsapp(knex)), bot: await resumenBot(knex).catch(() => null) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b: any = req.body || {}
  try {
    if (b.accion === "qr") return res.json(await qrConexion())
    if (b.accion === "webhook") return res.json(await configurarWebhook())
    if (b.accion === "bot") {
      await activarBot(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), !!b.activo)
      return res.json({ ok: true })
    }
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
