// Dashboard > Centro de control (lib/centro-control.ts)
//   GET /admin/hetna-control?dias=7|30|90 -> { ventas, avisos, conteo }
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { calcularCentroControl } from "../../../lib/centro-control"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const n = Number((req.query as Record<string, string>)?.dias)
  const dias = [1, 7, 30, 90].includes(n) ? n : 30
  try {
    res.json(await calcularCentroControl(req.scope, { dias }))
  } catch (e) {
    req.scope.resolve("logger").error(`[centro-control] ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo armar el centro de control." })
  }
}
