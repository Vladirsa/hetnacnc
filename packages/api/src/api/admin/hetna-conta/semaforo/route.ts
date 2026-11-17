// POST /admin/hetna-conta/semaforo  (multipart: archivo = XML del proveedor)
// Antes de pagar: verde / amarillo / rojo, sin guardar la factura.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { semaforo, refrescarListas } from "../../../../lib/conta/loop"
import { listaDeArchivos } from "../../../cam-multipart"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const a = listaDeArchivos(req as any)[0]
  if (!a || !/\.xml$/i.test(a.originalname)) return res.status(400).json({ message: "Sube el XML de la factura." })
  await refrescarListas(knex, req.scope.resolve("logger"))
  try {
    res.json(await semaforo(knex, ctb, a.buffer.toString("utf8")))
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
