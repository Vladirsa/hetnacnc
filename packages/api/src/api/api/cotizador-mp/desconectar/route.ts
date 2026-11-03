import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { desconectar } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-mp/desconectar  (sesión de Supabase)
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => desconectar(tokenDe(req)))
