import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ligaParaPaypal } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-paypal/conectar  (sesión de Supabase) -> { url }
// "Iniciar sesión con PayPal": el taller entra a su PayPal y lo vincula.
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => ligaParaPaypal(tokenDe(req)))
