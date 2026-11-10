import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { HERRAMIENTAS, RESULTADOS, registrarPrueba, resumenPruebas } from "../../../../lib/cam-pruebas"

/** GET /store/cam/pruebas -- cómo les fue a los talleres con cada control (público, sin nombres). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ pruebas: await resumenPruebas(req.scope) })
}

const Reporte = z.object({
  herramienta: z.enum(HERRAMIENTAS),
  controlador: z.string().min(1).max(40),
  resultado: z.enum(RESULTADOS),
  maquina: z.string().max(80).optional(),
  material: z.string().max(40).optional(),
  ejes: z.number().int().min(3).max(5).optional(),
  notas: z.string().max(600).optional(),
})

/** POST /store/cam/pruebas -- "probé este programa en mi máquina y me fue así". */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const r = Reporte.safeParse(req.body)
  if (!r.success) {
    res.status(400).json({ message: "Dinos en qué control lo probaste y cómo te fue." })
    return
  }
  await registrarPrueba(req.scope, req.auth_context.actor_id, r.data)
  res.json({ ok: true })
}
