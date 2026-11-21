import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { configFase4 } from "../../../lib/fase4"

// GET /store/fase4 → { activa, expres_pct } (lo que la tienda necesita mostrar)
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const c = configFase4()
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({ activa: c.activa, expres_pct: c.activa ? c.expresPct : null, garantia: c.activa && c.compensacionPctDia ? { pct_dia: c.compensacionPctDia, tope_pct: c.compensacionTopePct } : null })
}
