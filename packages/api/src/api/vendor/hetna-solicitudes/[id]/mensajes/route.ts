// Conversación privada cliente <-> taller después de elegir (Licitaciones 3.0, Fase 4)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { enviarMensaje, mensajesDe } from "../../../../../lib/safedeal"
import { NO_ENCONTRADA, solicitudTaller } from "../../../../../lib/safedeal-http"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  res.json({ mensajes: await mensajesDe(knex, s, "taller") })
}

export const POST = async (req: AuthenticatedMedusaRequest<{ texto?: string }>, res: MedusaResponse) => {
  const { knex, s } = await solicitudTaller(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const r: any = await enviarMensaje(knex, s, "taller", String((req.body as any)?.texto || ""), req.scope.resolve("logger"))
  if (!r.ok) return res.status(r.status).json({ message: r.message })
  res.json(r)
}
