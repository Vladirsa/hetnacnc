// GET    /admin/hetna-conta/efirma → estado de la e.firma, bitácora y solicitudes al SAT
// POST   /admin/hetna-conta/efirma (multipart: cer, key, clave) → valida y guarda cifrada
// DELETE /admin/hetna-conta/efirma → la borra
// La contraseña nunca se regresa ni se escribe en registros.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { ErrorEfirma, borrarEfirma, estadoEfirma, guardarEfirma } from "../../../../lib/conta/efirma"
import { solicitudesRecientes } from "../../../../lib/conta/descarga"
import { archivosDe } from "../../../cam-multipart"

const llaveLista = () => Buffer.from((process.env.CONTA_EFIRMA_KEY || "").trim(), "base64").length === 32

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.json({ efirma: null })
  res.json({ servidor_listo: llaveLista(), efirma: await estadoEfirma(knex, ctb.id), solicitudes: await solicitudesRecientes(knex, ctb.id) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const files = archivosDe(req as any)
  const cer = files.cer?.[0], key = files.key?.[0]
  const clave = String((req.body as any)?.clave || "")
  if (!cer || !key || !clave) return res.status(400).json({ message: "Sube el archivo .cer, el .key y escribe la contraseña de tu e.firma." })
  try {
    const r = await guardarEfirma(knex, ctb, cer.buffer, key.buffer, clave)
    res.json({ ok: true, rfc: r.rfc, vence: r.vence })
  } catch (e) {
    if (e instanceof ErrorEfirma) return res.status(e.status).json({ message: e.message })
    req.scope.resolve("logger").warn(`[conta] no se pudo guardar la e.firma: ${(e as Error).name}`)
    res.status(500).json({ message: "No se pudo guardar la e.firma." })
  }
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (ctb) await borrarEfirma(knex, ctb.id)
  res.json({ ok: true })
}
