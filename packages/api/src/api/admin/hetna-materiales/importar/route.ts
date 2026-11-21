// POST /admin/hetna-materiales/importar { fecha, materiales: [{ clave, nombre, mediana, minimo, maximo, n, fuentes }] }
// Lo llama n8n («Agente HETNA - Monitor de precios de materiales») con la llave secreta de admin.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { importarPrecios } from "../../../../lib/materiales-precios"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await importarPrecios(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), (req.body || {}) as any))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
