// GET/POST /vendor/hetna-filtro-clientes  { minimo: 0 | 4 | 4.5, nuevos: boolean }
// El taller decide de qué clientes recibe solicitudes según su reputación como
// comprador (Trust & Ranking, Licitaciones 3.0 Fase 4).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MINIMOS_CLIENTE, filtroClientes } from "../../../lib/trust"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const v = await knex("seller").where({ id: sellerId }).first("metadata")
  res.json(filtroClientes(v?.metadata))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b: any = req.body || {}
  const minimo = Number(b.minimo)
  if (!(MINIMOS_CLIENTE as readonly number[]).includes(minimo)) return res.status(400).json({ message: "Valor no válido." })
  const filtro = { minimo, nuevos: b.nuevos !== false && b.nuevos !== "false" }
  await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('filtro_clientes', ?::jsonb) where id = ?`, [JSON.stringify(filtro), sellerId])
  res.json({ ok: true, ...filtro })
}
