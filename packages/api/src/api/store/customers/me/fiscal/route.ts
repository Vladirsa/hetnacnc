import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { REGIMENES, USOS_CFDI, validarFiscal } from "../../../../../lib/facturas"

// Datos fiscales del cliente para que los talleres le facturen (CFDI 4.0).
//   GET  /store/customers/me/fiscal -> { fiscal, regimenes, usos }
//   POST /store/customers/me/fiscal { rfc, razon_social, regimen, cp, uso_cfdi, correo }
// Se guardan en customer.metadata.fiscal.
const clienteId = (req: MedusaRequest) => (req as any).auth_context?.actor_id as string | undefined

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const c = await knex("customer").where({ id }).first("metadata")
  const meta = typeof c?.metadata === "string" ? JSON.parse(c.metadata) : c?.metadata
  return res.json({ fiscal: meta?.fiscal || null, regimenes: REGIMENES, usos: USOS_CFDI })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const id = clienteId(req)
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const f = validarFiscal(req.body)
  if (typeof f === "string") return res.status(400).json({ message: f })
  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const actual = await clientes.retrieveCustomer(id)
  await clientes.updateCustomers(id, { metadata: { ...(actual?.metadata || {}), fiscal: f } })
  return res.json({ ok: true, fiscal: f })
}
