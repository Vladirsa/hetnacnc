// POST /vendor/hetna-cloud/clientes — crea o edita un cliente del taller.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_CLIENTE, asegurarCloud, nuevoId, textoCloud as texto } from "../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const b = (req.body || {}) as Record<string, unknown>
  const datos = {
    nombre: texto(b.nombre, 120),
    empresa: texto(b.empresa, 120) || null,
    correo: texto(b.correo, 160) || null,
    telefono: texto(b.telefono, 40) || null,
    notas: texto(b.notas, 2000) || null,
  }
  if (datos.nombre.length < 2) return res.status(400).json({ message: "Escribe el nombre del cliente." })
  if (b.id) {
    const n = await knex(T_CLIENTE).where({ id: String(b.id), seller_id: sellerId }).update({ ...datos, updated_at: knex.fn.now() })
    if (!n) return res.status(404).json({ message: "Cliente no encontrado." })
    return res.json({ cliente: await knex(T_CLIENTE).where({ id: String(b.id) }).first() })
  }
  const total = await knex(T_CLIENTE).where({ seller_id: sellerId }).count({ n: "*" }).first()
  if (Number(total?.n) >= 2000) return res.status(400).json({ message: "Llegaste al máximo de 2,000 clientes." })
  const id = nuevoId("ccl")
  await knex(T_CLIENTE).insert({ id, seller_id: sellerId, ...datos })
  return res.status(201).json({ cliente: await knex(T_CLIENTE).where({ id }).first() })
}
