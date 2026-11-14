// POST /hooks/social-hub/pinterest { code, state }  (con x-hetna-token)
// La tienda (hetnacnc.com/r/pinterest-callback) pasa aquí el código con que Pinterest
// regresa después de que el dueño entra con la cuenta de HETNA; aquí se cambia
// por los tokens. El "state" evita que alguien más conecte otra cuenta.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { conectarPinterest } from "../../../../lib/pinterest"
import { tokenValido } from "../../../../lib/social-hub-token"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tokenValido(req)) return res.status(401).json({ message: "No autorizado." })
  const b: any = req.body || {}
  const code = String(b.code || "").slice(0, 600)
  const state = String(b.state || "")
  if (!code || !/^[a-f0-9]{32}$/.test(state)) return res.status(400).json({ ok: false, message: "Faltan datos de Pinterest." })
  try {
    res.json(await conectarPinterest(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), code, state))
  } catch (e) {
    res.status(400).json({ ok: false, message: (e as Error).message })
  }
}
