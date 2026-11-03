import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { emitirFactura } from "../../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-cfdi/emitir  (sesión de Supabase)
// { pedido_id, rfc, razon_social, cp, regimen, uso, correo?, forma_pago?, metodo_pago? }
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => emitirFactura(tokenDe(req), (req.body || {}) as Record<string, any>, req.scope.resolve("logger")))
