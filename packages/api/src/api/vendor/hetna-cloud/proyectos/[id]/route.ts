// GET /vendor/hetna-cloud/proyectos/:id — piezas, archivos (todas las
// revisiones) y ligas para compartir de un proyecto del taller.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ORDEN_REVISIONES, T_ARCHIVO, T_CLIENTE, T_LIGA, T_PIEZA, T_PROYECTO, asegurarCloud, proyectoDe, urlLiga, vigentes } from "../../../../../lib/cloud"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const p = await proyectoDe(knex, sellerId, String(req.params.id))
  if (!p) return res.status(404).json({ message: "Proyecto no encontrado." })
  const [cliente, piezas, archivos, ligas] = await Promise.all([
    p.cliente_id ? knex(T_CLIENTE).where({ id: p.cliente_id, seller_id: sellerId }).first() : null,
    knex(T_PIEZA).where({ proyecto_id: p.id, seller_id: sellerId }).orderBy("created_at").select("*"),
    vigentes(knex(T_ARCHIVO).where({ proyecto_id: p.id, seller_id: sellerId }))
      .orderByRaw(ORDEN_REVISIONES)
      .select("id", "pieza_id", "nombre", "ext", "tamano", "cuenta_cupo", "categoria", "revision", "estado", "notas", "created_at"),
    knex(T_LIGA).where({ proyecto_id: p.id, seller_id: sellerId }).whereNull("revocada_en").where("vence", ">", knex.fn.now()).orderBy("created_at", "desc").select("*"),
  ])
  return res.json({ proyecto: p, cliente, piezas, archivos, ligas: (ligas as any[]).map((l) => ({ ...l, url: urlLiga(l.token) })) })
}

// DELETE /vendor/hetna-cloud/proyectos/:id — sólo si ya no tiene archivos.
export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const p = await proyectoDe(knex, sellerId, String(req.params.id))
  if (!p) return res.status(404).json({ message: "Proyecto no encontrado." })
  // Los que llegaron de una licitación se archivan: si se borraran, se volverían a importar.
  if (p.origen_tipo === "licitacion") {
    await knex(T_PROYECTO).where({ id: p.id, seller_id: sellerId }).update({ estado: "archivado", updated_at: knex.fn.now() })
    return res.json({ ok: true, archivado: true })
  }
  const quedan = await knex(T_ARCHIVO).where({ proyecto_id: p.id }).whereNull("deleted_at").first("id")
  if (quedan) return res.status(409).json({ message: "Primero borra los archivos del proyecto, o mejor archívalo." })
  await knex.transaction(async (trx: any) => {
    await trx(T_LIGA).where({ proyecto_id: p.id }).update({ revocada_en: knex.fn.now() })
    await trx(T_PIEZA).where({ proyecto_id: p.id }).delete()
    await trx(T_PROYECTO).where({ id: p.id, seller_id: sellerId }).delete()
  })
  return res.json({ ok: true })
}
