// POST /admin/hetna-clientes/reenviar { id } -- vuelve a mandar la liga y el código de confirmación
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { mandarCorreoVerificacion, requiereVerificacion } from "../../../../lib/verificar-correo"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = String((req.body as any)?.id || "")
  const [c] = id ? await (req.scope.resolve(Modules.CUSTOMER) as any).listCustomers({ id }, { take: 1 }) : []
  if (!c) return res.status(404).json({ message: "No encontré esa cuenta." })
  if (!requiereVerificacion(c)) return res.status(400).json({ message: "Esa cuenta ya confirmó su correo." })
  const r: any = await mandarCorreoVerificacion({ id: c.id, email: c.email, first_name: c.first_name }).catch((e) => ({ sent: false, reason: e.message }))
  if (r && r.sent === false) return res.status(400).json({ message: `No se mandó: ${r.reason || "error del correo"}` })
  res.json({ ok: true })
}
