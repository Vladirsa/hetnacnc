import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { packsDeTalleres } from "../../../lib/packs"

// GET /store/packs?seller_ids=sel_1,sel_2
//
// Los packs por categoría de cada taller: "llévate 3 de Bujes y el tercero va
// gratis". El backend ya los sabe aplicar -- son promociones `buyget` de Medusa,
// automáticas, y Mercur ya limita el descuento al taller dueño. Lo que faltaba
// era enseñarlos, porque un pack que el cliente no sabe que existe no lo hace
// llevar la tercera pieza.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const crudo = String(req.query.seller_ids || "")
  const sellerIds = [
    ...new Set(
      crudo
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].slice(0, 30)

  if (!sellerIds.length) {
    return res.json({ packs: [] })
  }

  const packs = await packsDeTalleres(req.scope, sellerIds)
  res.json({ packs })
}
