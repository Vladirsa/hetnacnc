import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { crearCodigo, desvincular, estadoVinculo, ligaEntrada } from "../../../lib/cotizador-vinculo"

// Cuenta de hetnacnc.com <-> taller del Cotizador (ver lib/cotizador-vinculo.ts)

/** GET /store/cotizador-vinculo -- ¿está vinculada? ¿qué taller y qué plan? */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    res.json(await estadoVinculo(knex, req.auth_context.actor_id))
  } catch {
    res.json({ vinculado: false })
  }
}

/**
 * POST /store/cotizador-vinculo { accion }
 *   "codigo"  -> { codigo, expira }  para escribirlo en la app
 *   "entrar"  -> { url }             liga de acceso a la app (null si no está vinculada)
 *   "quitar"  -> { ok }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const cliente = req.auth_context.actor_id
  const accion = String(((req.body || {}) as { accion?: string }).accion || "")
  try {
    if (accion === "codigo") return res.json(await crearCodigo(knex, cliente))
    if (accion === "entrar") return res.json({ url: await ligaEntrada(knex, cliente) })
    if (accion === "quitar") {
      await desvincular(knex, cliente)
      return res.json({ ok: true })
    }
    return res.status(400).json({ message: "Acción no válida" })
  } catch (e) {
    const logger = req.scope.resolve("logger") as any
    logger.error(`[cotizador-vinculo] ${accion}: ${(e as Error).message}`)
    return res.status(502).json({ message: "No se pudo completar. Intenta de nuevo en un momento." })
  }
}
