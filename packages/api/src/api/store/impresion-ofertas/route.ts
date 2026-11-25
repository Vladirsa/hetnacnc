// GET /store/impresion-ofertas?product_id=prod_...
// Los talleres que imprimen un diseño de "Impresión 3D bajo pedido": material,
// precio, días, colores, envío gratis y si el taller es destacado; más los
// gramos y el precio recomendado de cada material. 404 si no es de la colección.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ofertasPublicas } from "../../../lib/impresion-catalogo"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = String((req.query as Record<string, unknown>)?.product_id || "")
  if (!/^prod_[A-Za-z0-9]+$/.test(productId)) return res.status(400).json({ message: "Falta product_id." })
  const r = await ofertasPublicas(req.scope, productId)
  if (!r) return res.status(404).json({ message: "Ese producto no es de Impresión 3D bajo pedido." })
  res.setHeader("Cache-Control", "public, max-age=60")
  res.json(r)
}
