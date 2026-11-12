// POST /hooks/whatsapp { numero, texto?, tipo?, mensaje_id?, base64? }  (con x-hetna-token)
// La tienda (hetnacnc.com/r/wa/<token>) pasa aquí cada mensaje que llega al
// WhatsApp de HETNA. Responde { manejado } : si era verificación, BAJA/ALTA o
// fotos del taller, ya se contestó; si no, sigue el flujo normal (n8n).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { mensajeEntrante } from "../../../lib/whatsapp"
import { tokenValido } from "../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  try {
    res.json(
      await mensajeEntrante(
        req.scope,
        { numero: String(b.numero || ""), texto: String(b.texto || "").slice(0, 2000), tipo: String(b.tipo || "texto"), mensaje_id: b.mensaje_id ? String(b.mensaje_id).slice(0, 120) : undefined, base64: typeof b.base64 === "string" ? b.base64.slice(0, 12_000_000) : null },
        req.scope.resolve("logger")
      )
    )
  } catch (e) {
    req.scope.resolve("logger").warn(`[whatsapp] entrante: ${(e as Error).message}`)
    res.json({ manejado: false })
  }
}
