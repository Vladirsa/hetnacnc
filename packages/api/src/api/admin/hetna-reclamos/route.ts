// GET  /admin/hetna-reclamos?estado=abierto  -> reclamaciones de evaluaciones
// POST /admin/hetna-reclamos { id, accion: "ocultar" | "mantener", resolucion }
// Trust & Ranking (Licitaciones 3.0, Fase 4): procedimiento de reclamación y revisión.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { listarReclamos, resolverReclamo } from "../../../lib/trust"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const estado = ["abierto", "oculta", "mantenida"].includes(String((req.query as any)?.estado)) ? String((req.query as any).estado) : "abierto"
  res.json({ reclamos: await listarReclamos(knex, estado) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b: any = req.body || {}
  if (!["ocultar", "mantener"].includes(b.accion)) return res.status(400).json({ message: "Acción no válida." })
  try {
    res.json(await resolverReclamo(knex, String(b.id || ""), b.accion, b.resolucion))
  } catch (e) {
    const err = e as Error & { status?: number }
    res.status(err.status || 500).json({ message: err.message })
  }
}
