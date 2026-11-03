import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { guardarDatosFiscales } from "../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/datos  (administrador)
// { razon_social, regimen, cp, clave_producto?, clave_unidad?, serie? }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => guardarDatosFiscales(tokenDe(req), (req.body || {}) as Record<string, any>))
