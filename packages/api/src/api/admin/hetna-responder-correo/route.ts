// POST /admin/hetna-responder-correo  { de, asunto, texto, empresa?, tipo?, pais?, anteriores? }
// Lo llama n8n (flujo «Respuestas del correo») con la llave secreta de admin.
// Regresa { responder, asunto, cuerpo, html, motivo, resumen }; n8n manda el
// correo sólo si responder = true. Ver lib/correo-respuesta.ts.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cuerpoHtml, redactarRespuestaCorreo } from "../../../lib/correo-respuesta"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  const de = String(b.de || "").trim().toLowerCase()
  const texto = String(b.texto || "").trim()
  if (!de || !texto) return res.status(400).json({ message: "Faltan de y texto." })
  try {
    const r = await redactarRespuestaCorreo(req.scope as any, {
      de,
      asunto: String(b.asunto || ""),
      texto,
      empresa: String(b.empresa || ""),
      tipo: String(b.tipo || ""),
      pais: String(b.pais || ""),
      anteriores: Number(b.anteriores || 0),
    })
    res.json({ ...r, html: r.responder ? cuerpoHtml(r.cuerpo) : "" })
  } catch (e) {
    req.scope.resolve("logger").warn(`[responder-correo] ${de}: ${(e as Error).message}`)
    res.json({ responder: false, asunto: "", cuerpo: "", html: "", motivo: "La IA falló; contesta tú.", resumen: "" })
  }
}
