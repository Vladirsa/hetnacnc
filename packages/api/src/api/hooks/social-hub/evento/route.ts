// POST /hooks/social-hub/evento { codigo, tipo, valor?, ref? }  (con x-hetna-token)
// La tienda avisa de un registro, solicitud o venta de alguien que llegó por una
// liga de redes (cookie hetna_ref, 30 días). Social Hub, Fase 5A.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { registrarEvento } from "../../../../lib/social-hub"
import { tokenValido } from "../../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ok = await registrarEvento(knex, String(b.codigo || ""), String(b.tipo || ""), b.valor, b.ref).catch(() => false)
  res.json({ ok })
}
