// POST /admin/hetna-soporte-correo { de, asunto, texto, anteriores? }
// Lo llama n8n («Agente HETNA - Soporte») con la llave secreta de admin.
// Regresa { responder, asunto, cuerpo, html, borrador, categoria, motivo, resumen }:
// n8n manda el correo sólo si responder = true; si no, te pasa el borrador por Telegram.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cuerpoHtml } from "../../../lib/correo-respuesta"
import { redactarSoporte } from "../../../lib/soporte-correo"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, unknown>
  const de = String(b.de || "").trim().toLowerCase()
  const texto = String(b.texto || "").trim()
  if (!de || !texto) return res.status(400).json({ message: "Faltan de y texto." })
  try {
    const r = await redactarSoporte(req.scope as any, { de, asunto: String(b.asunto || ""), texto, anteriores: Number(b.anteriores || 0) })
    res.json({ ...r, html: r.responder ? cuerpoHtml(r.cuerpo) : "" })
  } catch (e) {
    req.scope.resolve("logger").warn(`[soporte-correo] ${de}: ${(e as Error).message}`)
    res.json({ responder: false, asunto: "", cuerpo: "", html: "", borrador: "", categoria: "otro", motivo: "La IA falló; contesta tú.", resumen: "" })
  }
}
