import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { aceptar } from "../../../../../lib/cotizacion-liga"
import { responder } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizacion-liga/<token>/aceptar  { nombre }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const b = (req.body || {}) as { nombre?: string }
    return aceptar(String(req.params.token || ""), String(b.nombre || ""))
  })
