// POST /admin/hetna-conta/auditar  { sat?: boolean } → corre el loop de auditoría ahora
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { correrAuditoria, refrescarListas } from "../../../../lib/conta/loop"

export const POST = async (req: AuthenticatedMedusaRequest<{ sat?: boolean }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  await refrescarListas(knex, logger)
  const r = await correrAuditoria(knex, ctb, { consultarSat: Boolean((req.body as any)?.sat), maxSat: 20, logger })
  res.json({ nuevos: r.nuevos, cerrados: r.cerrados, revisadas: r.revisadas, estatus: r.estatus })
}
