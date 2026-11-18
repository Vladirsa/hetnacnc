// GET /admin/hetna-calendario -> { listo, url, webcal, google }
// Liga del calendario de HETNA (tienda y licitaciones) para Google Calendar.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { ligaCalendarioHetna } from "../../../lib/calendario"
import { calendarioListo } from "../../../lib/calendario-ics"

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!calendarioListo()) return res.json({ listo: false })
  res.json({ listo: true, ...ligaCalendarioHetna() })
}
