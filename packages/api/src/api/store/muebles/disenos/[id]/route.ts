// GET    /store/muebles/disenos/:id — un diseño con sus datos, para abrirlo
// DELETE /store/muebles/disenos/:id — lo borra
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorDiseno, borrarDiseno, leerDiseno } from "../../../../../lib/disenos-guardados"

const valido = (id: string) => /^dis_[a-f0-9]{20}$/.test(id)

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!valido(req.params.id)) return res.status(400).json({ ok: false, mensaje: "Diseño inválido." })
  try {
    const d = await leerDiseno(req.scope, req.auth_context.actor_id, req.params.id)
    res.json({ ok: true, diseno: d })
  } catch (e) {
    if (e instanceof ErrorDiseno) return res.status(e.status).json({ ok: false, mensaje: e.message })
    throw e
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!valido(req.params.id)) return res.status(400).json({ ok: false, mensaje: "Diseño inválido." })
  await borrarDiseno(req.scope, req.auth_context.actor_id, req.params.id)
  res.json({ ok: true })
}
