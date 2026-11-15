// POST   /admin/hetna-conta/token → crea (o cambia) la liga de Excel conectado
// DELETE /admin/hetna-conta/token → la desactiva
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { nuevoTokenExcel, revocarTokenExcel } from "../../../../lib/conta/servicio"
import { STORE_URL } from "../../../../lib/licitacion"


export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const token = await nuevoTokenExcel(knex, ctb.id)
  res.json({ liga: `${STORE_URL}/api/conta-feed/${token}` })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (ctb) await revocarTokenExcel(knex, ctb.id)
  res.json({ ok: true })
}
