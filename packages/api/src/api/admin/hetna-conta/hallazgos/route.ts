// GET /admin/hetna-conta/hallazgos?estado=abierto&auditor=forense
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_HALLAZGO, contribuyenteHetna } from "../../../../lib/conta/almacen"
import { listasActualizadas } from "../../../../lib/conta/sat"

const ORDEN: Record<string, number> = { alta: 0, media: 1, baja: 2 }

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.json({ hallazgos: [] })
  const estado = ["abierto", "resuelto", "descartado"].includes(String(req.query.estado)) ? String(req.query.estado) : "abierto"
  const auditor = ["fiscal", "forense"].includes(String(req.query.auditor)) ? String(req.query.auditor) : null
  const filas = (await knex(T_HALLAZGO).where({ contribuyente_id: ctb.id, estado }).modify((q: any) => auditor && q.where({ auditor }))
    .orderBy("created_at", "desc").limit(500).select("*")) as any[]
  filas.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])
  res.json({ hallazgos: filas, listas: await listasActualizadas(knex) })
}
