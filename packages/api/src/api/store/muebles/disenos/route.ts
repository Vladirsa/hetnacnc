// GET  /store/muebles/disenos?herramienta=mueble — los diseños guardados del cliente (sin los datos)
// POST /store/muebles/disenos — guarda uno nuevo o actualiza (con id)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { ErrorDiseno, HERRAMIENTAS, guardarDiseno, listarDisenos } from "../../../../lib/disenos-guardados"
import { MAX_DISENOS_GUARDADOS } from "../../../../lib/precios-diseno"
import { avisarN8n } from "../../../../lib/disenos-correos"

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

// el aviso a n8n lleva quién es el cliente (correo y nombre) para darle seguimiento
async function avisarDisenoNuevo(req: AuthenticatedMedusaRequest, d: { herramienta: string; nombre: string; resumen?: string }) {
  let email: string | null = null, nombre: string | null = null
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [c] } = await query.graph({ entity: "customer", fields: ["email", "first_name", "last_name"], filters: { id: req.auth_context.actor_id } })
    email = (c as { email?: string } | undefined)?.email || null
    nombre = [(c as { first_name?: string })?.first_name, (c as { last_name?: string })?.last_name].filter(Boolean).join(" ") || null
  } catch {
    // sin datos del cliente el aviso sale igual
  }
  await avisarN8n("diseno_guardado", { customer_id: req.auth_context.actor_id, email, nombre, herramienta: d.herramienta, nombre_diseno: d.nombre, resumen: d.resumen || null })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ ok: false, mensaje: "Datos del diseño inválidos." })
  if (JSON.stringify(d.data.datos).length > 1_500_000) return res.status(413).json({ ok: false, mensaje: "El diseño es muy grande para guardarlo." })
  try {
    const id = await guardarDiseno(req.scope, req.auth_context.actor_id, d.data)
    // un diseño nuevo es un cliente interesado: al CRM (n8n), sin esperar respuesta
    if (!d.data.id) void avisarDisenoNuevo(req, d.data)
    res.json({ ok: true, id })
  } catch (e) {
    if (e instanceof ErrorDiseno) return res.status(e.status).json({ ok: false, mensaje: e.message })
    throw e
  }
}
