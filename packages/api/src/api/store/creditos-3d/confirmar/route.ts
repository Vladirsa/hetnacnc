// El cliente regresó del pago: se pregunta al proveedor y, si se aprobó, se
// acreditan los créditos (una sola vez).
//   POST /store/creditos-3d/confirmar  { compra }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { confirmarCompra, ErrorCompra } from "../../../../lib/creditos-compra"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = String(((req.body || {}) as { compra?: unknown }).compra || "")
  if (!/^cc_[a-f0-9]{24}$/.test(id)) return res.status(400).json({ message: "Compra no válida." })
  try {
    res.json(await confirmarCompra(req.scope, id, req.auth_context.actor_id))
  } catch (e) {
    if (e instanceof ErrorCompra) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[creditos] no se pudo confirmar la compra ${id}: ${(e as Error).message}`)
    res.status(502).json({ message: "No pudimos confirmar el pago todavía. Lo volvemos a revisar en unos minutos." })
  }
}
