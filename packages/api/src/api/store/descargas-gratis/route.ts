import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { DescargaError, descargarGratis, estadoDescargas } from "../../../lib/descargas-gratis"

/** GET /store/descargas-gratis -- cuántos archivos gratis le quedan esta semana. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const estado = await estadoDescargas(req.scope, req.auth_context.actor_id)
  res.json({ estado })
}

const Pedido = z.object({ product_id: z.string().min(1) })

/**
 * POST /store/descargas-gratis { product_id }
 *
 * Devuelve una liga firmada de B2 que dura una hora. Contesta 429 cuando ya
 * no le quedan descargas, con el estado para decirle cuándo se libera la
 * siguiente.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = Pedido.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta product_id.")
  }

  const customerId = req.auth_context.actor_id
  try {
    const r = await descargarGratis(req.scope, customerId, parsed.data.product_id)
    res.json(r)
  } catch (e) {
    if (!(e instanceof DescargaError)) throw e
    const status = e.codigo === "sin_cupo" ? 429 : e.codigo === "liga" ? 502 : 400
    res.status(status).json({
      message: e.message,
      codigo: e.codigo,
      estado: e.codigo === "sin_cupo" ? await estadoDescargas(req.scope, customerId) : undefined,
    })
  }
}
