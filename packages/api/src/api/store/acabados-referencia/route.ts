import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { tarifasAcabados } from "../../../lib/tarifa-doblez"

// GET /store/acabados-referencia → { acabados: [{ clave, nombre, tarifa, unidad, talleres }] }
// Acabados con precio de referencia (mediana de lo que ponen los talleres), para
// que el cliente los agregue a su precio en la calculadora (estrategia 2.1).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "public, max-age=600")
  res.json({ acabados: await tarifasAcabados(req.scope).catch(() => []) })
}
