// GET  /vendor/hetna-panel-taller
//   → { recibe_solicitudes, etapas: { [solicitud_id]: etapa } }
// POST /vendor/hetna-panel-taller  { recibe_solicitudes: boolean }
//
// Lo que el panel del taller de la tienda (/mx/panel-taller) necesita además
// de /vendor/hetna-solicitudes y /vendor/sellers/me:
//   · el interruptor "Recibiendo solicitudes": con false el taller deja de
//     recibir avisos de solicitudes nuevas (lib/difusion.ts). Las dirigidas a
//     él (el cliente lo eligió) le siguen llegando.
//   · la etapa de sus trabajos ganados (lib/etapa-taller.ts).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD } from "../../../lib/licitacion"
import { etapasDe } from "../../../lib/etapa-taller"

const recibeSolicitudes = (metadata: any) => metadata?.recibe_solicitudes !== false

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const v = await knex("seller").where({ id: sellerId }).first("metadata")
  // Trabajos ganados de este taller
  const ganadas = (await knex(`${T_SOLICITUD} as s`)
    .join(`${T_PROPUESTA} as p`, "p.id", "s.propuesta_elegida")
    .where("p.seller_id", sellerId)
    .select("s.id")
    .limit(500)) as { id: string }[]
  const etapas = await etapasDe(knex, ganadas.map((g) => g.id))
  res.json({ recibe_solicitudes: recibeSolicitudes(v?.metadata), etapas })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b: any = req.body || {}
  if (typeof b.recibe_solicitudes !== "boolean") return res.status(400).json({ message: "Falta recibe_solicitudes." })
  await knex.raw(
    `update seller set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('recibe_solicitudes', ?::boolean) where id = ?`,
    [b.recibe_solicitudes, sellerId]
  )
  res.json({ ok: true, recibe_solicitudes: b.recibe_solicitudes })
}
