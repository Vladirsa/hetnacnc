// POST /store/solicitudes-taller/:token/evaluacion  { accion: "responder" | "reclamar", texto }
// El cliente responde o reclama la evaluación que el taller hizo de él (Trust & Ranking, Fase 4).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { reclamarEvaluacion, responderEvaluacion } from "../../../../../lib/trust"
import { NO_ENCONTRADA, solicitudCliente } from "../../../../../lib/safedeal-http"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const b: any = req.body || {}
  try {
    const r = b.accion === "reclamar" ? await reclamarEvaluacion(knex, s, "cliente", b.texto) : await responderEvaluacion(knex, s, "cliente", b.texto)
    return res.json(r)
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo guardar." })
  }
}
