// GET  /vendor/hetna-solicitudes/:id/evaluacion -> evaluaciones de la solicitud ganada y reputación del cliente
// POST { accion: "evaluar", ...indicadores, comentario } | { accion: "responder" | "reclamar", texto }
// Trust & Ranking (Licitaciones 3.0, Fase 4): el taller evalúa al cliente con 7 indicadores.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { evaluacionesDe, guardarEvaluacionCliente, reclamarEvaluacion, reputacionCliente, responderEvaluacion } from "../../../../../lib/trust"
import { NO_ENCONTRADA, solicitudTaller } from "../../../../../lib/safedeal-http"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const [ev, rep] = await Promise.all([evaluacionesDe(knex, s, "taller"), reputacionCliente(knex, { clienteId: s.cliente_id, email: s.contacto?.email })])
  const pagada = s.pago_estado === "pagado" || s.pago_estado === "anticipo" || s.estado === "pagada" || s.estado === "cerrada"
  res.json({ ...ev, reputacion_cliente: rep, puede_evaluar: pagada && ["entregada", "cerrada"].includes(String(s.etapa || "")) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const b: any = req.body || {}
  try {
    let r: any
    if (b.accion === "evaluar") r = await guardarEvaluacionCliente(knex, s, (req as any).seller_context.seller_id, b, req.scope.resolve("logger"))
    else if (b.accion === "reclamar") r = await reclamarEvaluacion(knex, s, "taller", b.texto)
    else r = await responderEvaluacion(knex, s, "taller", b.texto)
    return res.json({ ok: true, ...r })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo guardar." })
  }
}
