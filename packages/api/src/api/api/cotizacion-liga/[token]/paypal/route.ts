import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { capturarPaypal, pagarConPaypal } from "../../../../../lib/cotizacion-liga"
import { responder } from "../../../cotizador-suscripcion/respuesta"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

// POST https://hetnacnc.com/api/cotizacion-liga/<token>/paypal  -> { url }
// Orden de PayPal con el dinero directo a la cuenta PayPal del taller.
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, () => pagarConPaypal(String(req.params.token || "")))

// GET .../paypal?token=<orden>&PayerID=...  <- regreso de PayPal
// Se cobra la orden y se manda al cliente de vuelta a su liga.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const liga = String(req.params.token || "")
  const orden = String((req.query as any)?.token || "")
  const logger = req.scope.resolve("logger") as any
  try {
    res.redirect(await capturarPaypal(liga, orden, logger))
  } catch (e) {
    logger.error(`[cotizador] PayPal regreso ${orden}: ${(e as Error).message}`)
    res.redirect(`${SITIO}/c/${encodeURIComponent(liga)}?pago=error`)
  }
}
