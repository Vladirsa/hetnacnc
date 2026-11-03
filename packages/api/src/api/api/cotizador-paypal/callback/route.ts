import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { terminarPaypal } from "../../../../lib/cotizacion-liga"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

// GET https://hetnacnc.com/api/cotizador-paypal/callback?code=...&state=...
// Regreso de "Iniciar sesión con PayPal". Debe estar registrada como Return URL
// en la app de PayPal de HETNA (Log in with PayPal).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as any
  const code = String(q.code || "")
  const state = String(q.state || "")
  const logger = req.scope.resolve("logger") as any
  if (!code || !state) {
    res.redirect(`${SITIO}/mercado-pago-conectado?resultado=cancelado&cuenta=paypal`)
    return
  }
  try {
    await terminarPaypal(code, state)
    res.redirect(`${SITIO}/mercado-pago-conectado?resultado=ok&cuenta=paypal`)
  } catch (e) {
    logger.error(`[cotizador] vincular PayPal: ${(e as Error).message}`)
    res.redirect(`${SITIO}/mercado-pago-conectado?resultado=error&cuenta=paypal`)
  }
}
