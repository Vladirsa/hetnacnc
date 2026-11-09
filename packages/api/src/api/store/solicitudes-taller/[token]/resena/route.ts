// POST /store/solicitudes-taller/:token/resena  { calidad, tiempo, comunicacion, precio, capacidad, profesionalismo, posventa, comentario }
// El cliente evalúa al taller (7 indicadores, 1 a 5) cuando su pedido ya se entregó (Trust & Ranking, Fase 4).
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas } from "../../../../../lib/licitacion"
import { guardarEvaluacionTaller } from "../../../../../lib/trust"
import { asegurarSeguimiento } from "../../../../../lib/seguimiento"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })
  await asegurarTablas(knex)
  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  try {
    const r = await guardarEvaluacionTaller(knex, s, (req.body || {}) as Record<string, unknown>, logger)
    return res.json({ ok: true, ...r })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo guardar tu calificación." })
  }
}
