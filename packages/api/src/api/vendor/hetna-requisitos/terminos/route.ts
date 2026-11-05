// POST /vendor/hetna-requisitos/terminos { version } — el taller acepta los
// Términos para vendedores vigentes. Se guarda versión, fecha, IP y quién.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ipCliente } from "../../../../lib/ip-cliente"
import { aceptarTerminos } from "../../../../lib/requisitos-vendedor"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const version = String((req.body as any)?.version || "")
  let quien = ""
  try {
    const actor = req.auth_context?.actor_id
    if (actor) quien = (await knex("member").where({ id: actor }).first("email"))?.email || actor
  } catch {
    quien = req.auth_context?.actor_id || ""
  }
  try {
    await aceptarTerminos(knex, sellerId, { version, ip: ipCliente(req as any), agente: String(req.headers["user-agent"] || ""), quien })
  } catch (e) {
    return res.status((e as any).status || 400).json({ message: (e as Error).message })
  }
  return res.json({ ok: true })
}
