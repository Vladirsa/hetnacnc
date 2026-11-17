// POST /admin/hetna-conta/archivos  (multipart: archivos[] = XML o ZIP)
// Facturas emitidas y recibidas. Las que no son del RFC de HETNA se rechazan.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cargarArchivos, contribuyenteHetna } from "../../../../lib/conta/almacen"
import { listaDeArchivos } from "../../../cam-multipart"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC en Contabilidad > Datos fiscales." })
  const archivos = listaDeArchivos(req as any)
  if (!archivos.length) return res.status(400).json({ message: "Elige uno o varios XML, o un ZIP." })
  const r = await cargarArchivos(knex, ctb, archivos.map((a) => ({ nombre: a.originalname, datos: a.buffer })), "xml")
  res.json(r)
}
