import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { HERRAMIENTAS_PROYECTO, ProyectoError, guardarProyecto, listarProyectos } from "../../../../lib/cam-proyectos"

/** GET /store/cam/proyectos?herramienta=2d|3d|torno -- los proyectos guardados de la cuenta. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const h = z.enum(HERRAMIENTAS_PROYECTO).safeParse(req.query.herramienta)
  res.json({ proyectos: await listarProyectos(req.scope, req.auth_context.actor_id, h.success ? h.data : undefined) })
}

const Pedido = z.object({
  id: z.string().max(40).nullish(),
  herramienta: z.enum(HERRAMIENTAS_PROYECTO),
  nombre: z.string().max(120).optional(),
  datos: z.unknown(),
})

/** POST /store/cam/proyectos -- guarda uno nuevo o reemplaza el propio (con id). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const p = Pedido.safeParse(req.body)
  if (!p.success || p.data.datos === undefined || p.data.datos === null) {
    res.status(400).json({ message: "Falta el proyecto que quieres guardar." })
    return
  }
  try {
    res.json({ proyecto: await guardarProyecto(req.scope, req.auth_context.actor_id, p.data as { herramienta: (typeof HERRAMIENTAS_PROYECTO)[number]; datos: unknown }) })
  } catch (e) {
    if (!(e instanceof ProyectoError)) throw e
    res.status(e.codigo === "tope" ? 402 : 413).json({ message: e.message, codigo: e.codigo })
  }
}
