// Empieza la compra directa de un paquete de créditos y devuelve la liga de pago.
//   POST /store/creditos-3d/comprar  { handle, proveedor: "mercadopago" | "paypal", pais? }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { crearCompra, ErrorCompra } from "../../../../lib/creditos-compra"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const cuerpo = (req.body || {}) as { handle?: unknown; proveedor?: unknown; pais?: unknown }
  try {
    const { id, url } = await crearCompra(req.scope, {
      customerId: req.auth_context.actor_id,
      handle: String(cuerpo.handle || ""),
      proveedor: String(cuerpo.proveedor || ""),
      pais: String(cuerpo.pais || "mx"),
    })
    res.json({ compra: id, url })
  } catch (e) {
    if (e instanceof ErrorCompra) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").error(`[creditos] no se pudo crear la compra: ${(e as Error).message}`)
    res.status(502).json({ message: "No se pudo preparar el pago. Intenta de nuevo en un momento." })
  }
}
