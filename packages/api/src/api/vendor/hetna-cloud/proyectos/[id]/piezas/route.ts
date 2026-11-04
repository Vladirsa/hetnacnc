// POST /vendor/hetna-cloud/proyectos/:id/piezas — crea o edita una pieza.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PIEZA, T_PROYECTO, asegurarCloud, nuevoId, proyectoDe, textoCloud as texto } from "../../../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const p = await proyectoDe(knex, sellerId, String(req.params.id))
  if (!p) return res.status(404).json({ message: "Proyecto no encontrado." })
  const b = (req.body || {}) as Record<string, unknown>
  const nombre = texto(b.nombre, 120)
  if (nombre.length < 1) return res.status(400).json({ message: "Escribe el nombre o número de la pieza." })
  const cantidad = parseInt(String(b.cantidad ?? ""), 10)
  const datos = {
    nombre,
    material: texto(b.material, 120) || null,
    cantidad: Number.isFinite(cantidad) && cantidad > 0 ? Math.min(cantidad, 10_000_000) : null,
    notas: texto(b.notas, 2000) || null,
  }
  if (b.id) {
    const n = await knex(T_PIEZA).where({ id: String(b.id), proyecto_id: p.id, seller_id: sellerId }).update(datos)
    if (!n) return res.status(404).json({ message: "Pieza no encontrada." })
  } else {
    const total = await knex(T_PIEZA).where({ proyecto_id: p.id }).count({ n: "*" }).first()
    if (Number(total?.n) >= 300) return res.status(400).json({ message: "Máximo 300 piezas por proyecto." })
    await knex(T_PIEZA).insert({ id: nuevoId("cpz"), seller_id: sellerId, proyecto_id: p.id, ...datos })
  }
  await knex(T_PROYECTO).where({ id: p.id }).update({ updated_at: knex.fn.now() })
  return res.json({ ok: true })
}
