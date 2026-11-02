import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { terminarConexion } from "../../../../lib/cotizacion-liga"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

// GET https://hetnacnc.com/api/cotizador-mp/callback?code=...&state=...
// Aquí regresa Mercado Pago cuando el taller autoriza. Se cambia el code por
// el token del taller y se guarda; luego se manda a una página de "listo".
// Esta URL debe estar registrada como Redirect URL en la app de Mercado Pago.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as any
  const code = String(q.code || "")
  const state = String(q.state || "")
  const logger = req.scope.resolve("logger") as any
  if (!code || !state) {
    res.redirect(`${SITIO}/cotizador/mercado-pago?resultado=cancelado`)
    return
  }
  try {
    await terminarConexion(code, state)
    res.redirect(`${SITIO}/cotizador/mercado-pago?resultado=ok`)
  } catch (e) {
    logger.error(`[cotizador] conectar Mercado Pago: ${(e as Error).message}`)
    res.redirect(`${SITIO}/cotizador/mercado-pago?resultado=error`)
  }
}
