import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { desconectarPaypal } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-paypal/desconectar  (sesión de Supabase)
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => desconectarPaypal(tokenDe(req)))
