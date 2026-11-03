import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { estadoCfdi } from "../../../lib/cotizador-cfdi"
import { responder, tokenDe } from "../cotizador-suscripcion/respuesta"

// GET https://hetnacnc.com/api/cotizador-cfdi  (sesión de Supabase)
// Estado de la factura electrónica del taller: datos, CSD, pendientes y cupo del mes.
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => estadoCfdi(tokenDe(req)))
