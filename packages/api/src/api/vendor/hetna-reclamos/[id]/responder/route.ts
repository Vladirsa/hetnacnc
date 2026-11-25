// El taller responde un reclamo con su versión y su evidencia.
//   POST /vendor/hetna-reclamos/:id/responder { respuesta, evidencias: [ids] }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { avisarRespuestaTaller } from "../../../../../lib/reclamos-correos"
import { ErrorReclamo, evidenciasDe, responderReclamo, vistaReclamo } from "../../../../../lib/reclamos-pedido"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b = (req.body || {}) as Record<string, unknown>
  try {
    const r = await responderReclamo(req.scope, { id: String(req.params.id || ""), sellerId, respuesta: b.respuesta, evidencias: b.evidencias })
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    res.json({ ok: true, reclamo: vistaReclamo(r, await evidenciasDe(knex, r.id)) })
    await avisarRespuestaTaller(req.scope, r).catch(() => undefined)
  } catch (e) {
    if (e instanceof ErrorReclamo) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
