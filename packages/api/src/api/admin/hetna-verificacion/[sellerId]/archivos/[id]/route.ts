// GET /admin/hetna-verificacion/:sellerId/archivos/:id -> el documento (solo administradores)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerExpediente } from "../../../../../../lib/verificacion"
import { encabezadosPrivados, leerArchivo } from "../../../../../../lib/verificacion-archivos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { sellerId, id } = req.params
  const exp = await leerExpediente(req.scope, sellerId)
  const a = exp?.archivos.find((x) => x.id === id)
  if (!a) return res.status(404).json({ message: "No existe." })
  try {
    res.set(encabezadosPrivados(a.mime)).send(await leerArchivo(sellerId, a))
  } catch {
    res.status(404).json({ message: "No se encontró el archivo." })
  }
}
