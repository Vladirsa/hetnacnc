import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { estadoPaypal } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizador-paypal/estado  (sesión de Supabase)
// { disponible, conectado, email, comision_pct, comision_tope, comision_tope_usd, comision_pendiente }
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => estadoPaypal(tokenDe(req)))
