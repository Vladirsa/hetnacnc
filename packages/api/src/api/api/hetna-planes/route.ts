// GET /api/hetna-planes — planes y comisiones de HETNA, públicos (sin llave),
// para la página de entrada del panel de vendedor. La misma fuente que la
// lista de precios de los Términos (lib/tarifas.ts).
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { tarifasHetna } from "../../../lib/tarifas"
import { MONTO_VERIFICACION, TERMINOS_VERSION } from "../../../lib/requisitos-vendedor"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "public, max-age=600")
  const t = await tarifasHetna(req.scope)
  res.json({
    actualizado: t.actualizado,
    grupos: t.grupos.filter((g: any) => ["ventas", "cotizador", "academia"].includes(g.id)),
    terminos_version: TERMINOS_VERSION,
    monto_verificacion: MONTO_VERIFICACION,
  })
}
