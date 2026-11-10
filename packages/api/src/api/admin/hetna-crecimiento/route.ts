// GET /admin/hetna-crecimiento → los números de la estrategia de crecimiento
// (activos, cotizaciones con simulador, licitaciones cerradas, nuevos,
// % que cotizó el primer día) y la tendencia de 8 semanas. Sólo administradores.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { metricasCrecimiento } from "../../../lib/crecimiento"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await metricasCrecimiento(req.scope))
  } catch (e) {
    res.status(502).json({ message: `No se pudieron calcular las métricas: ${(e as Error).message}` })
  }
}
