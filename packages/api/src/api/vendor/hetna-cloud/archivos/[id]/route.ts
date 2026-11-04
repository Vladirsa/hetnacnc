// POST /vendor/hetna-cloud/archivos/:id — cambia estado, categoría o notas.
// DELETE /vendor/hetna-cloud/archivos/:id — lo borra (y lo oculta en B2).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { hideFile } from "../../../../../lib/backblaze"
import { CATEGORIAS, ESTADOS, T_ARCHIVO, asegurarCloud, esClave, textoCloud as texto, vigentes } from "../../../../../lib/cloud"

const delTaller = async (req: AuthenticatedMedusaRequest, knex: any) => {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return { sellerId: null, a: null }
  await asegurarCloud(knex)
  const a = await vigentes(knex(T_ARCHIVO).where({ id: String(req.params.id), seller_id: sellerId })).first()
  return { sellerId, a }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const { sellerId, a } = await delTaller(req, knex)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  if (!a) return res.status(404).json({ message: "Archivo no encontrado." })
  const b = (req.body || {}) as Record<string, unknown>
  const cambios: Record<string, unknown> = { updated_at: knex.fn.now() }
  if (esClave(ESTADOS, b.estado)) cambios.estado = b.estado
  if (esClave(CATEGORIAS, b.categoria)) cambios.categoria = b.categoria
  if (typeof b.notas === "string") cambios.notas = texto(b.notas, 1000) || null
  await knex(T_ARCHIVO).where({ id: a.id }).update(cambios)
  return res.json({ ok: true })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const { sellerId, a } = await delTaller(req, knex)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  if (!a) return res.status(404).json({ message: "Archivo no encontrado." })
  await knex(T_ARCHIVO).where({ id: a.id }).update({ deleted_at: knex.fn.now() })
  // Sólo se oculta lo que subió el taller: los archivos del cliente siguen en su solicitud.
  if (a.cuenta_cupo && String(a.clave).startsWith(`cloud/${sellerId}/`)) {
    const r = await hideFile(a.clave).catch((e: Error) => ({ ok: false as const, reason: e.message }))
    if (!r.ok) logger.warn(`[cloud] no se ocultó ${a.clave} en B2: ${r.reason}`)
  }
  return res.json({ ok: true })
}
