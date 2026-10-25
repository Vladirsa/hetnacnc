import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { crearSuscripcion } from "../../../lib/cotizador-suscripciones"
import { responder, tokenDe } from "./respuesta"

// POST https://hetnacnc.com/api/cotizador-suscripcion  { plan, correo_pago? }
// La app del Cotizador pide suscribirse; devuelve { url } para pagar en Mercado Pago.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const b = (req.body || {}) as { plan?: string; correo_pago?: string }
    return crearSuscripcion({ token: tokenDe(req), plan: String(b.plan || ""), correoPago: b.correo_pago })
  })
