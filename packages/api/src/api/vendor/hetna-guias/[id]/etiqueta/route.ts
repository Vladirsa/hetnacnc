// Descarga la etiqueta PDF de la guía de un pedido (solo su taller).
//   GET /vendor/hetna-guias/:id/etiqueta
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ErrorGuia, etiquetaDelPedido } from "../../../../../lib/guias"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    const { contenido, tipo, nombre } = await etiquetaDelPedido(req.scope, sellerId, req.params.id)
    res.setHeader("Content-Type", tipo)
    res.setHeader("Content-Disposition", `attachment; filename="${nombre.replace(/[^\w.-]/g, "_")}"`)
    res.setHeader("Cache-Control", "private, no-store")
    res.send(contenido)
  } catch (e) {
    if (e instanceof ErrorGuia) return res.status(e.status).json({ message: e.message })
    res.status(502).json({ message: "No se pudo descargar la etiqueta. Intenta en un momento." })
  }
}
