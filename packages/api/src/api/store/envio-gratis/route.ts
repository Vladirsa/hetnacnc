import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { umbralesDeEnvioGratis } from "../../../lib/envio-gratis"

// GET /store/envio-gratis?seller_ids=sel_1,sel_2
//
// El umbral de envío gratis de cada taller, para poder decirle al cliente "te
// faltan $180 para que SASA te mande gratis" mientras todavía tiene el carrito
// abierto. El backend ya sabe cobrar cero cuando el carrito pasa el monto; lo
// que faltaba era enseñarlo, y un umbral que nadie ve no cambia la conducta de
// nadie.
//
// El umbral vive en el PRECIO de la opción de envío del taller (un precio de $0
// con regla `item_total >= X`), no en una promoción. La librería compartida
// explica por qué y qué implica; aquí nomás se expone.
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
    return res.json({ talleres: {} })
  }

  const talleres = await umbralesDeEnvioGratis(req.scope, sellerIds)
  res.json({ talleres })
}
