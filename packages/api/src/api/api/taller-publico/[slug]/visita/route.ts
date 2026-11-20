import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { registrarVisitaPagina } from "../../../../../lib/taller-pagina-visitas"

// POST https://hetnacnc.com/api/taller-publico/<slug>/visita  { origen: "pagina" | "widget" }
// Cuenta una visita al cotizador en línea del taller (sin datos personales).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await registrarVisitaPagina(knex, String(req.params.slug || ""), String((req.body as any)?.origen || "pagina"))
  } catch {}
  res.json({ ok: true })
}
