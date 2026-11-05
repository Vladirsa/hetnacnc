// Notificaciones al celular del cliente (lib/push.ts).
//   GET    -> llave pública para que el navegador se suscriba
//   POST   -> guarda la suscripción de este navegador para el cliente con sesión
//   DELETE -> la quita (body: { endpoint })
import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { borrarSuscripcion, guardarSuscripcion, llavePublicaPush, validarSuscripcion } from "../../../lib/push"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({ llave: llavePublicaPush() || null })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Inicia sesión para activar los avisos." })
  const b = (req.body || {}) as { suscripcion?: unknown; dispositivo?: string }
  const s = validarSuscripcion(b.suscripcion)
  if (!s) return res.status(400).json({ message: "Suscripción inválida." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await guardarSuscripcion(knex, s, { customerId }, b.dispositivo)
  res.json({ ok: true })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const endpoint = String(((req.body || {}) as { endpoint?: string }).endpoint || "")
  if (!endpoint) return res.status(400).json({ message: "Falta el endpoint." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await borrarSuscripcion(knex, endpoint, "cliente")
  res.json({ ok: true })
}
