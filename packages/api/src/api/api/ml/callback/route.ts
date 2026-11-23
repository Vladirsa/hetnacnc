import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { terminarConexion } from "../../../../lib/mercadolibre"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const PANEL = `${SITIO}/seller/mercadolibre`

// GET https://hetnacnc.com/api/ml/callback?code=...&state=...
// Aquí regresa Mercado Libre cuando el taller autoriza. Esta dirección tiene que
// estar registrada TAL CUAL como Redirect URI en la app de Mercado Libre.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query || {}) as Record<string, unknown>
  const code = String(q.code || "")
  const state = String(q.state || "")
  const logger = req.scope.resolve("logger") as any
  if (!code || !state) return res.redirect(`${PANEL}?resultado=cancelado`)
  try {
    await terminarConexion(req.scope, code, state)
    res.redirect(`${PANEL}?resultado=ok`)
  } catch (e) {
    logger.error(`[mercadolibre] conectar: ${(e as Error).message}`)
    res.redirect(`${PANEL}?resultado=error`)
  }
}
