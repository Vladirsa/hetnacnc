// POST /vendor/hetna-requisitos/tarjeta { proveedor: "mercadopago" | "paypal" }
// Devuelve la liga para verificar la tarjeta con un cargo de $10 que se devuelve.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ligaMercadoPago, ligaPayPal } from "../../../../lib/requisitos-vendedor"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const seller = await knex("seller").where({ id: sellerId }).first("id", "email", "name", "metadata")
  if (!seller) return res.status(404).json({ message: "Taller no encontrado." })
  const proveedor = String((req.body as any)?.proveedor || "")
  try {
    const url = proveedor === "paypal" ? await ligaPayPal(seller) : await ligaMercadoPago(seller)
    return res.json({ url })
  } catch (e) {
    logger.error(`[requisitos] no se generó la liga de verificación (${proveedor}) de ${sellerId}: ${(e as Error).message}`)
    return res.status((e as any).status || 503).json({ message: (e as any).status ? (e as Error).message : "No pudimos abrir el pago. Intenta en un momento." })
  }
}
