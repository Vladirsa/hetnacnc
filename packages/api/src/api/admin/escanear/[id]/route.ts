// GET  /admin/escanear/:id
// POST /admin/escanear/:id — { estado?, disenador?, notas_internas?, verificacion?, comentario? }
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { ESTADOS, NOMBRE_ESTADO, avisarCliente, cargar, conEstado, duraciones, folioEscanear, guardar } from "../../../../lib/escanear"

const knexDe = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const s = await cargar(knexDe(req), String(req.params.id))
  if (!s) return res.status(404).json({ message: "No encontrada." })
  res.json({ solicitud: { ...s, folio_texto: folioEscanear(s.folio), nombre_estado: NOMBRE_ESTADO[s.estado], duraciones: duraciones(s) } })
}

const mm = z.number().min(0).max(100000)
const Cuerpo = z.object({
  estado: z.enum(ESTADOS).optional(),
  disenador: z.string().trim().max(80).nullable().optional(),
  notas_internas: z.string().max(5000).nullable().optional(),
  verificacion: z
    .array(z.object({ medida: z.string().trim().min(1).max(60), esperado_mm: mm, medido_mm: mm, tolerancia_mm: mm, nota: z.string().max(200).optional() }))
    .max(30)
    .optional(),
  comentario: z.string().trim().max(2000).optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ message: "Datos no válidos." })
  const knex = knexDe(req)
  const s = await cargar(knex, String(req.params.id))
  if (!s) return res.status(404).json({ message: "No encontrada." })
  if (d.data.estado === "render_listo" && !s.archivos.some((a) => a.tipo === "render" || a.tipo === "modelo"))
    return res.status(400).json({ message: "Sube primero el render o el modelo rediseñado para que el cliente tenga qué aprobar." })
  const cambios: Record<string, unknown> = {}
  if (d.data.estado && d.data.estado !== s.estado) Object.assign(cambios, conEstado(s, d.data.estado))
  if (d.data.disenador !== undefined) cambios.disenador = d.data.disenador || null
  if (d.data.notas_internas !== undefined) cambios.notas_internas = d.data.notas_internas || null
  // ok se calcula aquí: medido dentro de la tolerancia
  if (d.data.verificacion) cambios.verificacion = d.data.verificacion.map((v) => ({ ...v, ok: Math.abs(v.medido_mm - v.esperado_mm) <= v.tolerancia_mm }))
  if (d.data.comentario) cambios.comentarios = [...s.comentarios, { de: "equipo", texto: d.data.comentario, creado: new Date().toISOString() }]
  if (!Object.keys(cambios).length) return res.json({ ok: true, solicitud: s })
  const n = await guardar(knex, s.id, cambios)
  if (cambios.estado) void avisarCliente(n!, req.scope.resolve("logger"))
  res.json({ ok: true, solicitud: { ...n!, folio_texto: folioEscanear(n!.folio), nombre_estado: NOMBRE_ESTADO[n!.estado], duraciones: duraciones(n!) } })
}
