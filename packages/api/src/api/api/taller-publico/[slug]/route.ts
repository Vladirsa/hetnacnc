import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { perfilPublico } from "../../../../lib/cotizador-en-linea"
import { responder } from "../../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/taller-publico/<slug>
// Perfil público del taller y los servicios que cotiza en línea (sin tarifas).
export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "public, max-age=60")
  return responder(req, res, () => perfilPublico(String(req.params.slug || "")))
}
