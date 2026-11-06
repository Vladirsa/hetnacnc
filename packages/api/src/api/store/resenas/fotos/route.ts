// POST /store/resenas/fotos  { imagen: "data:image/jpeg;base64,..." }
// Sube una foto suelta para la reseña que el cliente está escribiendo
// (lib/resena-fotos.ts). Se liga a la reseña al publicarla.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarFotoResena } from "../../../../lib/resena-fotos"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    const id = await guardarFotoResena(knex, customerId, String(((req.body || {}) as { imagen?: string }).imagen || ""))
    res.status(201).json({ id })
  } catch (e) {
    res.status((e as { status?: number }).status || 500).json({ message: (e as Error).message || "No se pudo subir la foto." })
  }
}
