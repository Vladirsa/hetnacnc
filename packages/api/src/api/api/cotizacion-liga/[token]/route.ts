import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { paginaPublica } from "../../../../lib/cotizacion-liga"
import { responder } from "../../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizacion-liga/<token>
// Lo que ve el cliente en hetnacnc.com/c/<token>. Público: el token es la llave.
export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => paginaPublica(String(req.params.token || "")))
