// Paquetes de créditos a la venta y formas de pago disponibles (público).
//   GET /store/creditos-3d/paquetes
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listarPaquetes, proveedoresDisponibles } from "../../../../lib/creditos-compra"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paquetes = await listarPaquetes(req.scope)
  res.json({
    paquetes: paquetes.map((p) => ({ ...p, moneda: "mxn" })),
    proveedores: proveedoresDisponibles(),
  })
}
