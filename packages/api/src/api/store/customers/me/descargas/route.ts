// Mis descargas: las compras digitales pagadas del cliente.
//   GET /store/customers/me/descargas
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { comprasDigitales } from "../../../../../lib/mis-descargas"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const lista = await comprasDigitales(req.scope, req.auth_context.actor_id)
  // La llave del bucket no sale al navegador
  res.json({ descargas: lista.map(({ storage_key, ...resto }) => resto) })
}
