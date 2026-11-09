// HETNA SafeDeal + HETNA Sign: estado del acuerdo y acciones
// (guardar | aprobar | codigo | firmar). Licitaciones 3.0, Fase 4.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { accionAcuerdo, estadoAcuerdo } from "../../../../../lib/safedeal"
import { NO_ENCONTRADA, agenteDe, ipDe, solicitudCliente } from "../../../../../lib/safedeal-http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  res.json(await estadoAcuerdo(knex, s, "cliente"))
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const r: any = await accionAcuerdo(knex, s, "cliente", req.body || {}, { ip: ipDe(req), agente: agenteDe(req), logger: req.scope.resolve("logger") })
  if (!r.ok) return res.status(r.status).json({ message: r.message })
  res.json(r)
}
