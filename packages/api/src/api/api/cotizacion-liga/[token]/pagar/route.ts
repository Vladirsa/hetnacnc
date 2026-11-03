import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { pagarAnticipo } from "../../../../../lib/cotizacion-liga"
import { responder } from "../../../cotizador-suscripcion/respuesta"

// POST https://hetnacnc.com/api/cotizacion-liga/<token>/pagar  -> { url }
// Checkout Pro en la cuenta de Mercado Pago del taller, con la comisión HETNA
// como marketplace_fee.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => pagarAnticipo(String(req.params.token || "")))
