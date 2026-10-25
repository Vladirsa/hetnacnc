import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { crearSuscripcionPaypal } from "../../../lib/cotizador-paypal"
import { crearSuscripcion, preciosCotizador } from "../../../lib/cotizador-suscripciones"
import { responder, tokenDe } from "./respuesta"

// POST https://hetnacnc.com/api/cotizador-suscripcion  { plan, proveedor?, correo_pago? }
// La app del Cotizador pide suscribirse; devuelve { url } para pagar.
// proveedor: "mercadopago" (México, MXN; por defecto) o "paypal" (USD).
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => {
    const b = (req.body || {}) as { plan?: string; proveedor?: string; correo_pago?: string }
    const plan = String(b.plan || "")
    if (b.proveedor === "paypal") return crearSuscripcionPaypal({ token: tokenDe(req), plan })
    return crearSuscripcion({ token: tokenDe(req), plan, correoPago: b.correo_pago })
  })

// GET: precios en MXN y USD y qué medios de pago están activos (para la pantalla de planes)
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, async () => preciosCotizador())
