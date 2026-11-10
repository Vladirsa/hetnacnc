import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { ProyectoError, borrarProyecto, compartirProyecto, leerProyecto } from "../../../../../lib/cam-proyectos"

const noExiste = (res: MedusaResponse, e: unknown) => {
  if (!(e instanceof ProyectoError)) throw e
  res.status(404).json({ message: e.message, codigo: e.codigo })
}

/** GET /store/cam/proyectos/:id -- lo abre su dueño, o cualquiera con la liga si está compartido. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    res.json({ proyecto: await leerProyecto(req.scope, req.params.id, req.auth_context?.actor_id) })
  } catch (e) {
    noExiste(res, e)
  }
}

/** POST /store/cam/proyectos/:id { compartido } -- enciende o apaga la liga para compartir. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const p = z.object({ compartido: z.boolean() }).safeParse(req.body)
  if (!p.success) {
    res.status(400).json({ message: "Falta indicar si se comparte." })
    return
  }
  try {
    res.json({ proyecto: await compartirProyecto(req.scope, req.auth_context.actor_id, req.params.id, p.data.compartido) })
  } catch (e) {
    noExiste(res, e)
  }
}

/** DELETE /store/cam/proyectos/:id */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await borrarProyecto(req.scope, req.auth_context.actor_id, req.params.id)
  res.json({ ok: true })
}
