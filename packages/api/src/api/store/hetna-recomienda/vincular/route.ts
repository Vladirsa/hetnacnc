// Al registrarse con la liga de un amigo (?ref=CODIGO), la tienda manda el
// código aquí con la sesión de la cuenta nueva (lib/cupones.ts).
//   POST /store/hetna-recomienda/vincular { codigo } -> { ok, vinculado }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { vincularReferido } from "../../../../lib/cupones"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const codigo = String(((req.body || {}) as { codigo?: string }).codigo || "")
  try {
    res.json({ ok: true, vinculado: await vincularReferido(req.scope, id, codigo) })
  } catch (e) {
    req.scope.resolve("logger").warn(`[recomienda] vincular ${id}: ${(e as Error).message}`)
    res.json({ ok: true, vinculado: false })
  }
}
