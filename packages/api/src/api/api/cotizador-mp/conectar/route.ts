import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ligaParaConectar } from "../../../../lib/cotizacion-liga"
import { responder, tokenDe } from "../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizador-mp/conectar  (sesión de Supabase) -> { url }
// La app abre la URL: el taller entra a su Mercado Pago y autoriza a HETNA.
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => ligaParaConectar(tokenDe(req)))
