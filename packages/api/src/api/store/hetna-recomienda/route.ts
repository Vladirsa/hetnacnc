// Mi cuenta > Recomienda y gana (lib/cupones.ts).
//   GET /store/hetna-recomienda -> { codigo, liga, monto, minimo, amigos..., cupones, bienvenida }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resumenRecomienda } from "../../../lib/cupones"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  try {
    res.json(await resumenRecomienda(req.scope, id))
  } catch (e) {
    req.scope.resolve("logger").warn(`[recomienda] resumen ${id}: ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo cargar. Intenta de nuevo." })
  }
}
