// GET /vendor/hetna-clientes → { clientes } del taller, sin correo ni teléfono.
import type { MedusaResponse } from "@medusajs/framework/http"

import { clientesDelTaller } from "../../../lib/clientes-taller"
import type { VendorRequest } from "../tablero/vendor-request"

export const GET = async (req: VendorRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    res.json({ clientes: await clientesDelTaller(req.scope, sellerId) })
  } catch (e) {
    res.status(502).json({ message: `No se pudieron leer tus clientes: ${(e as Error).message}` })
  }
}
