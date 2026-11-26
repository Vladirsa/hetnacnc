// Panel del taller > Mis servicios: servicios con precio "desde" que salen en
// su perfil y en las páginas de servicio (lib/paquetes-servicio.ts).
//   GET  /vendor/hetna-paquetes
//   POST /vendor/hetna-paquetes  { paquetes: [...] }  (reemplaza la lista)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CATEGORIAS_PAQUETE, ErrorPaquete, MAX_PAQUETES, normalizarPaquetes, paquetesDe } from "../../../lib/paquetes-servicio"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const s = await knex("seller").where({ id: sellerId }).first("handle", "metadata")
  res.json({ paquetes: paquetesDe(s?.metadata), handle: s?.handle || null, categorias: CATEGORIAS_PAQUETE, max: MAX_PAQUETES })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  try {
    const paquetes = normalizarPaquetes((req.body as any)?.paquetes)
    await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('paquetes', ?::jsonb) where id = ?`, [
      JSON.stringify(paquetes),
      sellerId,
    ])
    res.json({ ok: true, paquetes })
  } catch (e) {
    if (e instanceof ErrorPaquete) return res.status(400).json({ message: e.message })
    throw e
  }
}
