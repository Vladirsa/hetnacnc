// POST /vendor/hetna-cloud/proyectos — crea o edita un proyecto del taller.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ESTADOS_PROYECTO, T_CLIENTE, T_PROYECTO, asegurarCloud, esClave, nuevoId, textoCloud as texto } from "../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const b = (req.body || {}) as Record<string, unknown>
  const nombre = texto(b.nombre, 140)
  if (nombre.length < 2) return res.status(400).json({ message: "Escribe el nombre del proyecto." })
  const estado = esClave(ESTADOS_PROYECTO, b.estado) ? b.estado : "activo"
  let clienteId: string | null = b.cliente_id ? String(b.cliente_id) : null
  if (clienteId && !(await knex(T_CLIENTE).where({ id: clienteId, seller_id: sellerId }).first("id"))) clienteId = null
  const datos = { nombre, estado, cliente_id: clienteId, notas: texto(b.notas, 4000) || null }

  if (b.id) {
    const n = await knex(T_PROYECTO).where({ id: String(b.id), seller_id: sellerId }).update({ ...datos, updated_at: knex.fn.now() })
    if (!n) return res.status(404).json({ message: "Proyecto no encontrado." })
    return res.json({ proyecto: await knex(T_PROYECTO).where({ id: String(b.id) }).first() })
  }
  const total = await knex(T_PROYECTO).where({ seller_id: sellerId }).count({ n: "*" }).first()
  if (Number(total?.n) >= 5000) return res.status(400).json({ message: "Llegaste al máximo de 5,000 proyectos. Archiva o borra los viejos." })
  const id = nuevoId("cpr")
  await knex(T_PROYECTO).insert({ id, seller_id: sellerId, origen_tipo: "manual", origen_ref: id, ...datos })
  return res.status(201).json({ proyecto: await knex(T_PROYECTO).where({ id }).first() })
}
