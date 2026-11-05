// Notificaciones al celular del taller (lib/push.ts): pedidos nuevos,
// solicitudes de fabricación, respuestas de clientes.
//   GET ?endpoint=  -> llave pública y si este navegador ya está activado
//   POST            -> guarda la suscripción de este navegador para el taller
//   DELETE          -> la quita (body: { endpoint })
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  borrarSuscripcion,
  guardarSuscripcion,
  llavePublicaPush,
  pushATalleres,
  tieneSuscripcion,
  validarSuscripcion,
} from "../../../lib/push"

const tallerDe = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const endpoint = String((req.query as { endpoint?: string }).endpoint || "")
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const estado = endpoint ? await tieneSuscripcion(knex, endpoint) : { taller: false }
  res.json({ llave: llavePublicaPush() || null, activo: estado.taller })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = tallerDe(req)
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const b = (req.body || {}) as { suscripcion?: unknown; dispositivo?: string; probar?: boolean }
  const s = validarSuscripcion(b.suscripcion)
  if (!s) return res.status(400).json({ message: "Suscripción inválida." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await guardarSuscripcion(knex, s, { sellerId }, b.dispositivo)
  // Aviso de prueba, para que el taller vea que sí le llegan
  await pushATalleres(
    knex,
    [sellerId],
    { titulo: "¡Avisos activados!", cuerpo: "Aquí te avisaremos de pedidos nuevos, solicitudes de fabricación y mensajes de clientes.", url: "/seller/tablero", etiqueta: "prueba" },
    req.scope.resolve("logger")
  )
  res.json({ ok: true })
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const endpoint = String(((req.body || {}) as { endpoint?: string }).endpoint || "")
  if (!endpoint) return res.status(400).json({ message: "Falta el endpoint." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await borrarSuscripcion(knex, endpoint, "taller")
  res.json({ ok: true })
}
