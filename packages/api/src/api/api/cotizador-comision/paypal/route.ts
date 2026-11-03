import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { pagoComisionPaypal } from "../../../../lib/cotizador-comisiones"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

// GET https://hetnacnc.com/api/cotizador-comision/paypal?token=<orden>
// Regreso de PayPal al pagar la comisión mensual en dólares.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const orden = String((req.query as any)?.token || "")
  try {
    const ok = await pagoComisionPaypal(orden)
    res.redirect(`${SITIO}/mercado-pago-conectado?resultado=${ok ? "comision" : "error"}`)
  } catch (e) {
    logger.error(`[comisiones] PayPal ${orden}: ${(e as Error).message}`)
    res.redirect(`${SITIO}/mercado-pago-conectado?resultado=error`)
  }
}
