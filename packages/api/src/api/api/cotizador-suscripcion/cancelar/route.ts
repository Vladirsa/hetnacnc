import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { cancelarSuscripcion } from "../../../../lib/cotizador-suscripciones"
import { responder, tokenDe } from "../respuesta"

// POST /api/cotizador-suscripcion/cancelar — el plan sigue hasta el fin del periodo pagado
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => cancelarSuscripcion(tokenDe(req)))
