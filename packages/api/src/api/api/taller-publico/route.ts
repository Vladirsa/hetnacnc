import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { directorio } from "../../../lib/cotizador-en-linea"
import { responder } from "../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/taller-publico
// Talleres con cotizador en línea activo y visibles en el directorio (/t).
export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "public, max-age=300")
  return responder(req, res, () => directorio())
}
