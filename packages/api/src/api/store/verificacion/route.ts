import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { requiereVerificacion } from "../../../lib/verificar-correo"

/** GET /store/verificacion -- ¿la cuenta de esta sesión todavía tiene que confirmar su correo? */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [c] = await (req.scope.resolve(Modules.CUSTOMER) as any).listCustomers(
    { id: req.auth_context.actor_id },
    { take: 1 }
  )
  res.json({ requiere: requiereVerificacion(c), email: c?.email || null })
}
