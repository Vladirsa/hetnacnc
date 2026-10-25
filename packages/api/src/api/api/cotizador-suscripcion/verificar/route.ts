import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { verificarSuscripcion } from "../../../../lib/cotizador-suscripciones"
import { responder, tokenDe } from "../respuesta"

// POST /api/cotizador-suscripcion/verificar — "Ya pagué, actualizar mi plan"
export const POST = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, () => verificarSuscripcion(tokenDe(req)))
