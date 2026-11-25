// Panel del taller > Piezas para imprimir > Destacar (lib/disenos-destacado.ts).
//   POST { dias: 7 | 30 } -> { url } liga de pago de Mercado Pago
// Al pagarse, el aviso de Mercado Pago (/api/mp-envio) activa el destacado.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { crearPagoDestacado, planesDestacado, precioDestacado } from "../../../../lib/disenos-destacado"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const dias = Number((req.body as any)?.dias)
  if (!precioDestacado(dias)) return res.status(400).json({ message: `Elige ${planesDestacado().map((p) => p.dias).join(" o ")} días.` })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const s = await knex("seller").where({ id: sellerId }).first("email")
  try {
    const r = await crearPagoDestacado(knex, sellerId, dias, s?.email)
    if (!r.url) return res.status(503).json({ message: "Los pagos con Mercado Pago no están disponibles en este momento. Escríbenos por WhatsApp." })
    res.json({ url: r.url })
  } catch (e) {
    req.scope.resolve("logger").warn(`[destacado] ${sellerId}: ${(e as Error).message}`)
    res.status(502).json({ message: "No pudimos crear el pago. Intenta de nuevo en unos minutos." })
  }
}
