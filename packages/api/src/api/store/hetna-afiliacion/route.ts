// GET /store/hetna-afiliacion (cliente con sesión): su número de afiliación.
// Las cuentas de antes del 14 nov 2026 lo reciben aquí la primera vez.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { afiliar } from "../../../lib/afiliacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const clientes = req.scope.resolve(Modules.CUSTOMER) as any
  const [c] = await clientes.listCustomers({ id }, { take: 1 })
  if (!c?.email) return res.status(404).json({ message: "No encontramos tu cuenta." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const a = await afiliar(knex, {
    email: c.email,
    nombre: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
    telefono: c.phone || null,
    origen: "registro",
    customerId: c.id,
  })
  if (!a) return res.status(400).json({ message: "Correo no válido." })
  if (c.metadata?.afiliacion !== a.numero) {
    await clientes.updateCustomers(c.id, { metadata: { ...(c.metadata || {}), afiliacion: a.numero } })
  }
  res.json({ numero: a.numero, desde: a.created_at })
}
