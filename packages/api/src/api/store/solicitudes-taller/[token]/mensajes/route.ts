// Conversación privada cliente <-> taller después de elegir (Licitaciones 3.0, Fase 4)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { enviarMensaje, mensajesDe } from "../../../../../lib/safedeal"
import { NO_ENCONTRADA, solicitudCliente } from "../../../../../lib/safedeal-http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  res.json({ mensajes: await mensajesDe(knex, s, "cliente") })
}

export const POST = async (req: MedusaRequest<{ texto?: string }>, res: MedusaResponse) => {
  const { knex, s } = await solicitudCliente(req)
  if (!s) return res.status(404).json(NO_ENCONTRADA)
  const r: any = await enviarMensaje(knex, s, "cliente", String((req.body as any)?.texto || ""), req.scope.resolve("logger"))
  if (!r.ok) return res.status(r.status).json({ message: r.message })
  res.json(r)
}
