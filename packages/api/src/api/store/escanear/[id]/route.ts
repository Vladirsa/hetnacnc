// GET  /store/escanear/:id — una solicitud del cliente
// POST /store/escanear/:id — { accion: "aprobar" | "ajuste" | "comentar", texto }
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { avisarEquipo, cargar, conEstado, guardar, vistaCliente } from "../../../../lib/escanear"
import { knexDe } from "../helpers"

async function propia(req: AuthenticatedMedusaRequest) {
  const s = await cargar(knexDe(req), String(req.params.id))
  return s && s.customer_id === req.auth_context.actor_id ? s : null
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const s = await propia(req)
  if (!s) return res.status(404).json({ message: "No encontramos esa solicitud." })
  res.json({ solicitud: vistaCliente(s) })
}

const Cuerpo = z.object({ accion: z.enum(["aprobar", "ajuste", "comentar"]), texto: z.string().trim().max(2000).optional() })

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ message: "Acción no válida." })
  const s = await propia(req)
  if (!s) return res.status(404).json({ message: "No encontramos esa solicitud." })
  const knex = knexDe(req)
  const texto = d.data.texto || ""
  if (d.data.accion !== "aprobar" && !texto) return res.status(400).json({ message: "Escribe tu comentario." })
  if (d.data.accion !== "comentar" && s.estado !== "render_listo") return res.status(409).json({ message: "Todavía no hay un render para aprobar." })
  const comentario = { de: "cliente" as const, texto: texto || "Aprobado.", ...(d.data.accion === "comentar" ? {} : { accion: d.data.accion }), creado: new Date().toISOString() }
  const cambios: Record<string, unknown> = { comentarios: [...s.comentarios, comentario] }
  if (d.data.accion === "aprobar") Object.assign(cambios, conEstado(s, "aprobada"))
  if (d.data.accion === "ajuste") Object.assign(cambios, { estado: "en_rediseno" })
  const n = await guardar(knex, s.id, cambios)
  const etiqueta = d.data.accion === "aprobar" ? "✅ El cliente APROBÓ el render" : d.data.accion === "ajuste" ? "✏️ El cliente pidió un ajuste" : "💬 Comentario del cliente"
  void avisarEquipo(knex, n!, `${etiqueta}${texto ? `\n${texto.slice(0, 500)}` : ""}`, req.scope.resolve("logger"))
  res.json({ ok: true, solicitud: vistaCliente(n!) })
}
