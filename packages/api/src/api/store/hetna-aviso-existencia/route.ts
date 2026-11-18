// POST /store/hetna-aviso-existencia  { product_id, variant_id?, email }
// "Avísame cuando haya" en un producto agotado (lib/aviso-existencia).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorAviso, registrarAviso } from "../../../lib/aviso-existencia"

export const POST = async (req: MedusaRequest<{ product_id?: string; variant_id?: string; email?: string }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const actor = (req as any).auth_context?.actor_type === "customer" ? (req as any).auth_context?.actor_id : null
  try {
    const r = await registrarAviso(knex, { productId: String(b.product_id || ""), variantId: b.variant_id || null, email: String(b.email || ""), customerId: actor })
    res.json(r)
  } catch (e) {
    if (e instanceof ErrorAviso) return res.status(e.status).json({ message: e.message })
    throw e
  }
}
