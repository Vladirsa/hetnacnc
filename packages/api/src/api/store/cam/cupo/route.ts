import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { CamCupoError, TIPOS_CAM, consumirCam, estadoCam, estadoCamAnonimo } from "../../../../lib/cam-cupo"

/** GET /store/cam/cupo -- qué incluye su plan en el CAM y cuánto lleva en el mes. Sin sesión: las reglas del plan Gratis. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const id = req.auth_context?.actor_id
  res.json(id ? { sesion: true, estado: await estadoCam(req.scope, id) } : { sesion: false, estado: estadoCamAnonimo() })
}

const Pedido = z.object({ tipo: z.enum(TIPOS_CAM), ref: z.string().max(80).optional() })

/**
 * POST /store/cam/cupo { tipo, ref? } -- autoriza la descarga de un programa y la cuenta.
 * 402 si su plan no incluye ese trabajo, 429 si ya se acabó el cupo del mes.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pedido = Pedido.safeParse(req.body)
  if (!pedido.success) {
    res.status(400).json({ message: "Falta el tipo de programa." })
    return
  }
  const id = req.auth_context.actor_id
  try {
    const r = await consumirCam(req.scope, id, pedido.data.tipo, pedido.data.ref)
    res.json({ ok: true, ...r })
  } catch (e) {
    if (!(e instanceof CamCupoError)) throw e
    res.status(e.codigo === "plan" ? 402 : 429).json({
      ok: false,
      codigo: e.codigo,
      message: e.message,
      plan_necesario: e.plan_necesario,
      estado: await estadoCam(req.scope, id),
    })
  }
}
