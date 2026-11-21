// POST /hooks/academia/invitar-blog { modo: "ver" | "prueba" | "enviar", correo? }  (con x-hetna-token)
// Lo usa n8n ("Academia - Invitar instructores al blog"). Ver lib/invitacion-blog.ts.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { invitarBlog } from "../../../../lib/invitacion-blog"
import { tokenValido } from "../../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b = (req.body || {}) as { modo?: string; correo?: string }
  try {
    const r = await invitarBlog(req.scope, String(b.modo || ""), b.correo)
    res.status(r.ok || b.modo === "prueba" ? 200 : 400).json(r)
  } catch (e) {
    req.scope.resolve("logger").error(`[invitacion-blog] ${(e as Error).message}`)
    res.status(500).json({ ok: false, error: "No se pudo completar." })
  }
}
