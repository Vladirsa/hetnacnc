// HETNA SafeDeal + HETNA Sign: estado del acuerdo y acciones
// (guardar | aprobar | codigo | firmar). Licitaciones 3.0, Fase 4.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { accionAcuerdo, estadoAcuerdo } from "../../../../../lib/safedeal"
import { NO_ENCONTRADA, agenteDe, ipDe, solicitudTaller } from "../../../../../lib/safedeal-http"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  res.json(await estadoAcuerdo(knex, s, "taller"))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const r: any = await accionAcuerdo(knex, s, "taller", req.body || {}, { ip: ipDe(req), agente: agenteDe(req), logger: req.scope.resolve("logger") })
  if (!r.ok) return res.status(r.status).json({ message: r.message })
  res.json(r)
}
