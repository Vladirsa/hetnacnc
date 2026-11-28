// Aviso de productos nuevos en el celular (lib/push.ts, jobs/novedades-push.ts).
// Sin cuenta: cualquier visitante lo activa desde /mx/novedades o la portada.
// Si hay sesión, la suscripción también queda ligada al cliente.
//   POST   { suscripcion, dispositivo } -> activa
//   DELETE { endpoint }                 -> lo quita (sólo el aviso de novedades)
// Limitado por IP en middlewares.ts.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { borrarSuscripcion, guardarSuscripcion, pushListo, validarSuscripcion } from "../../../../lib/push"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!pushListo()) return res.status(503).json({ message: "Los avisos todavía no están disponibles." })
  const b = (req.body || {}) as { suscripcion?: unknown; dispositivo?: string }
  const s = validarSuscripcion(b.suscripcion)
  if (!s) return res.status(400).json({ message: "Suscripción inválida." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await guardarSuscripcion(knex, s, { customerId: req.auth_context?.actor_id || null, novedades: true }, b.dispositivo)
  res.json({ ok: true })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const endpoint = String(((req.body || {}) as { endpoint?: string }).endpoint || "")
  if (!endpoint) return res.status(400).json({ message: "Falta el endpoint." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  // quien tiene el endpoint (el navegador suscrito) puede quitar su propio aviso de novedades
  await borrarSuscripcion(knex, endpoint, "novedades")
  res.json({ ok: true })
}
