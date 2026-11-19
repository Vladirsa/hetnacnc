// GET  /store/muebles/disenos?herramienta=mueble — los diseños guardados del cliente (sin los datos)
// POST /store/muebles/disenos — guarda uno nuevo o actualiza (con id)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { ErrorDiseno, HERRAMIENTAS, guardarDiseno, listarDisenos } from "../../../../lib/disenos-guardados"
import { MAX_DISENOS_GUARDADOS } from "../../../../lib/precios-diseno"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const h = typeof req.query.herramienta === "string" && (HERRAMIENTAS as readonly string[]).includes(req.query.herramienta) ? req.query.herramienta : undefined
  const disenos = await listarDisenos(req.scope, req.auth_context.actor_id, h)
  res.json({ ok: true, disenos, maximo: MAX_DISENOS_GUARDADOS })
}

const Cuerpo = z.object({
  id: z.string().regex(/^dis_[a-f0-9]{20}$/).optional(),
  herramienta: z.enum(HERRAMIENTAS),
  nombre: z.string().trim().min(1).max(120),
  resumen: z.string().max(300).optional(),
  datos: z.record(z.string(), z.unknown()),
})

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ ok: false, mensaje: "Datos del diseño inválidos." })
  if (JSON.stringify(d.data.datos).length > 1_500_000) return res.status(413).json({ ok: false, mensaje: "El diseño es muy grande para guardarlo." })
  try {
    const id = await guardarDiseno(req.scope, req.auth_context.actor_id, d.data)
    res.json({ ok: true, id })
  } catch (e) {
    if (e instanceof ErrorDiseno) return res.status(e.status).json({ ok: false, mensaje: e.message })
    throw e
  }
}
