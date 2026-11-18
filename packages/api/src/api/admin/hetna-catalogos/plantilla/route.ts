// GET /admin/hetna-catalogos/plantilla → Excel para cargar el catálogo de un taller del Cotizador
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { plantillaXlsx } from "../../../../lib/cotizador-catalogo"

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const buf = await plantillaXlsx()
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-catalogo-taller.xlsx"')
  res.send(buf)
}
