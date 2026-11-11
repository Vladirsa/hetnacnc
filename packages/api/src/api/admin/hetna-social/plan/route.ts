// GET  /admin/hetna-social/plan?semana=AAAA-MM-DD -> huecos del plan semanal con su estado
// POST /admin/hetna-social/plan { accion: "generar" | "llenar", semana }
// El agente de contenido llena los huecos con borradores (IA o plantilla) para revisar.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { generarPlan, llenarPlan, lunesDe, temarioCompleto, temasPendientes, verPlan } from "../../../../lib/estrategia"

const semanaDe = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? lunesDe(new Date(`${v}T12:00:00Z`)) : lunesDe())

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const semana = semanaDe((req.query as any)?.semana)
  res.json({ semana, huecos: await verPlan(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), semana) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const b: any = req.body || {}
  const semana = semanaDe(b.semana)
  const logger = req.scope.resolve("logger")
  if (b.accion === "generar") return res.json(await generarPlan(knex, semana))
  if (b.accion === "temas") return res.json({ publicos: await temasPendientes(knex) })
  if (b.accion === "temario") {
    // Escribir todos los textos tarda (uno por tema con IA): se hace en segundo plano
    const pend = await temasPendientes(knex)
    const total = pend.filter((p) => !b.publicos?.length || b.publicos.includes(p.clave)).reduce((s, p) => s + p.pendientes, 0)
    setImmediate(() => temarioCompleto(knex, logger, { publicos: Array.isArray(b.publicos) ? b.publicos : undefined }).catch((e) => logger.warn(`[temario] ${(e as Error).message}`)))
    return res.json({ ok: true, en_proceso: true, temas: total })
  }
  if (b.accion === "llenar") return res.json(await llenarPlan(knex, semana, logger, Math.min(80, Number(b.limite) || 40)))
  res.status(400).json({ message: "Acción no válida." })
}
