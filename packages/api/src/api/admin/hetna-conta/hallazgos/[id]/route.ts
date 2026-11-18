// POST /admin/hetna-conta/hallazgos/:id  { estado: "resuelto" | "descartado" | "abierto", nota? }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_HALLAZGO, contribuyenteHetna } from "../../../../../lib/conta/almacen"

export const POST = async (req: AuthenticatedMedusaRequest<{ estado?: string; nota?: string }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Sin datos fiscales." })
  const b = (req.body || {}) as any
  if (!["resuelto", "descartado", "abierto"].includes(b.estado)) return res.status(400).json({ message: "Estado no válido." })
  const n = await knex(T_HALLAZGO).where({ id: String(req.params.id), contribuyente_id: ctb.id })
    .update({ estado: b.estado, nota: b.nota ? String(b.nota).slice(0, 500) : null, updated_at: knex.fn.now() })
  if (!n) return res.status(404).json({ message: "No encontrado." })
  res.json({ ok: true })
}
