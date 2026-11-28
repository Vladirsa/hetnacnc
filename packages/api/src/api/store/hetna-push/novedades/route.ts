// Aviso de productos nuevos en el celular (lib/push.ts, jobs/novedades-push.ts).
// Sin cuenta: cualquier visitante lo activa desde /mx/novedades o la portada.
// No se liga a la cuenta: quien lo activa sólo pidió novedades (máximo uno al
// día), no los avisos de pedidos ni de promociones.
//   POST   { suscripcion, dispositivo } -> activa
//   DELETE { endpoint }                 -> lo quita (sólo el aviso de novedades)
// Limitado por IP en middlewares.ts.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { borrarSuscripcion, endpointDePush, guardarSuscripcion, pushListo, validarSuscripcion } from "../../../../lib/push"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!pushListo()) return res.status(503).json({ message: "Los avisos todavía no están disponibles." })
  const b = (req.body || {}) as { suscripcion?: unknown; dispositivo?: string }
  const s = validarSuscripcion(b.suscripcion)
  // sólo servicios de avisos reales: la ruta es pública y el servidor le mandará avisos a esa dirección
  if (!s || !endpointDePush(s.endpoint)) return res.status(400).json({ message: "Suscripción inválida." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await guardarSuscripcion(knex, s, { novedades: true }, b.dispositivo)
  res.json({ ok: true })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const endpoint = String(((req.body || {}) as { endpoint?: string }).endpoint || "")
  if (!endpoint) return res.status(400).json({ message: "Falta el endpoint." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  // quien tiene el endpoint (el navegador suscrito) puede quitar su propio aviso de novedades
  await borrarSuscripcion(knex, endpoint, "novedades")
  res.json({ ok: true })
}
