// POST /admin/hetna-conta/movimientos  (multipart: archivo = plantilla llena)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { leerMovimientos } from "../../../../lib/conta/excel"
import { guardarMovimientos } from "../../../../lib/conta/servicio"
import { listaDeArchivos } from "../../../cam-multipart"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const a = listaDeArchivos(req as any)[0]
  if (!a || !/\.xlsx$/i.test(a.originalname)) return res.status(400).json({ message: "Sube la plantilla en formato .xlsx." })
  let leido
  try {
    leido = await leerMovimientos(a.buffer)
  } catch {
    return res.status(400).json({ message: "No se pudo leer el Excel. Usa la plantilla." })
  }
  const r = await guardarMovimientos(knex, ctb.id, leido.movimientos)
  res.json({ ...r, errores: leido.errores })
}
