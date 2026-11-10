// POST /hooks/social-hub/telegram { tipo: "mensaje" | "boton", chat_id, texto?, data? }  (con x-hetna-token)
// n8n pasa aquí lo que el dueño le escribe al bot de Telegram o los botones que
// toca en los borradores. Responde { respuesta } y n8n la manda al chat.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { atender } from "../../../../lib/social-telegram"
import { tokenValido } from "../../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  if (!/^-?\d{1,20}$/.test(String(b.chat_id || ""))) return res.status(400).json({ message: "Falta el chat." })
  try {
    const respuesta = await atender(
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      { tipo: b.tipo === "boton" ? "boton" : "mensaje", chat_id: String(b.chat_id), texto: String(b.texto || "").slice(0, 4000), data: String(b.data || "").slice(0, 64) },
      req.scope.resolve("logger")
    )
    res.json({ ok: true, respuesta })
  } catch (e) {
    res.json({ ok: false, respuesta: `Error: ${(e as Error).message}`.slice(0, 300) })
  }
}
