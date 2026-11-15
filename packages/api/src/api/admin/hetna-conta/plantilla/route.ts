// GET /admin/hetna-conta/plantilla → Excel para capturar cobros y gastos sin factura
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { plantillaMovimientos } from "../../../../lib/conta/excel"

export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla-movimientos.xlsx"')
  res.send(await plantillaMovimientos())
}
