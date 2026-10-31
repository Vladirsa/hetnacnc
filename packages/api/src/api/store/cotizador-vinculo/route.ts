import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorSuscripcion } from "../../../lib/cotizador-suscripciones"
import {
  activarCotizador,
  crearCodigo,
  desvincular,
  entradaCotizador,
  estadoVinculo,
  reenviarConfirmacionCotizador,
} from "../../../lib/cotizador-vinculo"

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
 *   "entrar"  -> { url } | { confirmar } | { activar } | { cuenta }  (ver entradaCotizador)
 *   "activar" { taller, telefono } -> { url }   crea su taller del Cotizador y entra
 *   "confirmar" -> { ok }            vuelve a mandar la liga para confirmar el correo
 *   "quitar"  -> { ok }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const cliente = req.auth_context.actor_id
  const cuerpo = (req.body || {}) as { accion?: string; taller?: string; telefono?: string }
  const accion = String(cuerpo.accion || "")
  try {
    if (accion === "codigo") return res.json(await crearCodigo(knex, cliente))
    if (accion === "entrar") return res.json(await entradaCotizador(knex, cliente))
    if (accion === "activar") {
      return res.json(await activarCotizador(knex, cliente, { taller: cuerpo.taller, telefono: cuerpo.telefono }))
    }
    if (accion === "confirmar") {
      await reenviarConfirmacionCotizador(knex, cliente)
      return res.json({ ok: true })
    }
    if (accion === "quitar") {
      await desvincular(knex, cliente)
      return res.json({ ok: true })
    }
    return res.status(400).json({ message: "Acción no válida" })
  } catch (e) {
    if (e instanceof ErrorSuscripcion) return res.status(e.status).json({ message: e.message })
    const logger = req.scope.resolve("logger") as any
    logger.error(`[cotizador-vinculo] ${accion}: ${(e as Error).message}`)
    return res.status(502).json({ message: "No se pudo completar. Intenta de nuevo en un momento." })
  }
}
