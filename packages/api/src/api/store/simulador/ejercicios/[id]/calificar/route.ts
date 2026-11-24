// POST /store/simulador/ejercicios/:id/calificar { codigo } — califica en el
// servidor la pieza que deja el programa y guarda el mejor resultado.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MAX_CARACTERES } from "../../../../../../lib/simulador/calificar"
import { calificarYGuardar, ErrorSim } from "../../../../../../lib/simulador/progreso"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cliente = req.auth_context?.actor_id
  if (!cliente) return res.status(401).json({ message: "Inicia sesión para calificar tus ejercicios." })
  const codigo = (req.body as any)?.codigo
  if (typeof codigo !== "string" || !codigo.trim()) return res.status(400).json({ message: "Escribe tu programa antes de calificar." })
  if (codigo.length > MAX_CARACTERES) return res.status(413).json({ message: "El programa es demasiado grande." })
  try {
    res.setHeader("Cache-Control", "private, no-store")
    res.json(await calificarYGuardar(req.scope, cliente, req.params.id, codigo))
  } catch (e) {
    if (e instanceof ErrorSim) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
