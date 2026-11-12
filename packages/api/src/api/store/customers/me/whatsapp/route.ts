// Verificar el WhatsApp del cliente (cuenta en la tienda).
// GET  /store/customers/me/whatsapp -> { verificado, numero?, avisos? }
// POST /store/customers/me/whatsapp { accion: "iniciar", numero } -> { liga } (abre WhatsApp con el mensaje ya escrito)
//                                   | { accion: "codigo", numero }  (respaldo: se le manda el código)
//                                   | { accion: "confirmar", numero, codigo }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { confirmarCodigo, estadoDe, iniciarVerificacion, mandarCodigo } from "../../../../../lib/whatsapp"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión." })
  res.json(await estadoDe(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), { customer_id: customerId }))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  try {
    if (b.accion === "iniciar") {
      const r = await iniciarVerificacion(knex, { numero: String(b.numero || ""), quien: "cliente", customer_id: customerId })
      return res.json({ numero: r.numero, liga: r.liga })
    }
    if (b.accion === "codigo") return res.json(await mandarCodigo(knex, String(b.numero || "")))
    if (b.accion === "confirmar") return res.json(await confirmarCodigo(knex, String(b.numero || ""), String(b.codigo || "")))
    res.status(400).json({ message: "Acción no válida." })
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
