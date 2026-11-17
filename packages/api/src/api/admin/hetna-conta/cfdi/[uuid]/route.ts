// POST /admin/hetna-conta/cfdi/:uuid  { categoria?, tipo_activo? }  → corrige cómo cuenta una factura
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CATEGORIAS, T_CFDI, contribuyenteHetna } from "../../../../../lib/conta/almacen"
import { DEPRECIACION } from "../../../../../lib/conta/parametros"

export const POST = async (req: AuthenticatedMedusaRequest<{ categoria?: string; tipo_activo?: string }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Sin datos fiscales." })
  const b = (req.body || {}) as any
  const cambios: Record<string, any> = {}
  if (b.categoria !== undefined) {
    if (!(b.categoria in CATEGORIAS)) return res.status(400).json({ message: "Categoría no válida." })
    cambios.categoria = b.categoria
    cambios.categoria_manual = true
  }
  if (b.tipo_activo !== undefined) {
    if (b.tipo_activo !== null && !(b.tipo_activo in DEPRECIACION)) return res.status(400).json({ message: "Tipo de activo no válido." })
    cambios.tipo_activo = b.tipo_activo
  }
  if (!Object.keys(cambios).length) return res.status(400).json({ message: "Nada que cambiar." })
  const n = await knex(T_CFDI).where({ contribuyente_id: ctb.id, uuid: String(req.params.uuid).toUpperCase() }).update(cambios)
  if (!n) return res.status(404).json({ message: "Esa factura no está." })
  res.json({ ok: true })
}
