import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { estadoConexion } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizador-mp/estado  (sesión de Supabase)
// { disponible, conectado, mp_user_id, conectado_en, comision_pct, comision_tope }
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => estadoConexion(tokenDe(req)))
