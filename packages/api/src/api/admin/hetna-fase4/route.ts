// HETNA Panel → Estrategia → Fase 4 (sólo el dueño): qué claves faltan para
// encender "HETNA responde" y las compensaciones por entrega tarde.
//   GET  /admin/hetna-fase4
//   POST /admin/hetna-fase4 { solicitud_id, estado: "aplicada" | "descartada" }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_COMPENSACION, panelFase4 } from "../../../lib/fase4"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await panelFase4(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b: any = req.body || {}
  if (!["aplicada", "descartada"].includes(b.estado)) return res.status(400).json({ message: "Estado inválido." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await panelFase4(knex)
  await knex(T_COMPENSACION).where({ solicitud_id: String(b.solicitud_id || "") }).update({ estado: b.estado })
  res.json({ ok: true })
}
