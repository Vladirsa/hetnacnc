// GET /vendor/hetna-impresion/pedido/:id
// Lo que el cliente pidió en cada pieza de Impresión 3D bajo pedido de un pedido
// del taller: el color, los colores de cada parte (variantes "· 2 colores") y el
// texto de los llaveros y letras. Lo muestra el recuadro de la página del pedido
// en el panel (apps/vendor/src/widgets/pedido-personalizado.tsx). Sólo pedidos del taller.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { detalleRenglon } from "../../../../../lib/detalle-renglon"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const orderId = String(req.params.id || "")
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return res.status(400).json({ message: "Pedido no válido." })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: ligas } = await query.graph({ entity: "order_seller", fields: ["seller_id"], filters: { order_id: orderId } as any })
  if (!(ligas as any[]).some((l) => l.seller_id === sellerId)) return res.status(404).json({ message: "No encontramos ese pedido." })
  const { data: pedidos } = await query.graph({ entity: "order", fields: ["id", "items.id", "items.title", "items.product_title", "items.variant_title", "items.quantity", "items.metadata"], filters: { id: orderId } })
  const piezas = (((pedidos as any[])[0]?.items || []) as any[])
    .map((i) => ({
      id: i.id as string,
      titulo: String(i.product_title || i.title || ""),
      variante: String(i.variant_title || ""),
      cantidad: Number(i.quantity || 0),
      detalle: detalleRenglon(i.metadata),
    }))
    .filter((p) => p.detalle.length)
  res.setHeader("Cache-Control", "private, no-store")
  res.json({ piezas })
}
