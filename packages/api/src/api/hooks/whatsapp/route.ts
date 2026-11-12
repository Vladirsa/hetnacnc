// POST /hooks/whatsapp { numero, texto?, tipo?, mensaje_id?, base64? }  (con x-hetna-token)
// La tienda (hetnacnc.com/r/wa/<token>) pasa aquí cada mensaje que llega al
// WhatsApp de HETNA. Responde { manejado } : si era verificación, BAJA/ALTA o
// fotos del taller, ya se contestó; si no, sigue el flujo normal (n8n).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { esPropio, mensajeEntrante } from "../../../lib/whatsapp"
import { intentarResponder, pausarChat } from "../../../lib/whatsapp-bot"
import { tokenValido } from "../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  const logger = req.scope.resolve("logger")
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    // Lo escribió alguien de HETNA desde el celular (no el sistema): el respondedor se calla en ese chat
    if (b.desde_mi) {
      const id = b.mensaje_id ? String(b.mensaje_id) : null
      // Evolution a veces avisa antes de que el sistema reciba la confirmación de su envío
      if (!esPropio(id)) await new Promise((ok) => setTimeout(ok, 4000))
      if (!esPropio(id)) await pausarChat(knex, String(b.numero || ""))
      return res.json({ manejado: true })
    }
    const m = { numero: String(b.numero || ""), texto: String(b.texto || "").slice(0, 2000), tipo: String(b.tipo || "texto"), mensaje_id: b.mensaje_id ? String(b.mensaje_id).slice(0, 120) : undefined, base64: typeof b.base64 === "string" ? b.base64.slice(0, 12_000_000) : null }
    const r = await mensajeEntrante(req.scope, m, logger)
    if (r.manejado) return res.json(r)
    // Si no era verificación, BAJA/ALTA ni fotos: el respondedor (si está encendido)
    if (await intentarResponder(knex, m, logger).catch(() => false)) return res.json({ manejado: true, accion: "respondedor" })
    res.json(r)
  } catch (e) {
    logger.warn(`[whatsapp] entrante: ${(e as Error).message}`)
    res.json({ manejado: false })
  }
}
