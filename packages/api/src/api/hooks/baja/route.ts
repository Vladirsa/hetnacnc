// Baja de correos promocionales. Llega desde la tienda (/api/baja), que reenvía
// el correo y la firma. Sin firma válida no se hace nada.
//   POST /hooks/baja?e=<correo>&t=<firma>
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { darDeBaja, firmaValida } from "../../../lib/baja"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, string>
  const correo = String(q.e || "").trim().toLowerCase()
  if (!correo.includes("@") || !firmaValida(correo, String(q.t || ""))) {
    return res.status(400).json({ ok: false })
  }
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await darDeBaja(knex, correo)
  req.scope.resolve("logger").info(`[baja] ${correo} se dio de baja de correos promocionales`)
  res.json({ ok: true })
}
