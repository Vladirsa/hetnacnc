// @ts-nocheck
// Ayudas HTTP compartidas por las rutas de SafeDeal (cliente con su liga
// secreta y taller con su sesión).
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas } from "./licitacion"
import { asegurarPrivacidad } from "./licitacion-privacidad"
import { asegurarSafeDeal } from "./safedeal"

export const ipDe = (req: any) =>
  String(req.headers?.["cf-connecting-ip"] || String(req.headers?.["x-forwarded-for"] || "").split(",")[0] || req.ip || "").trim().slice(0, 64) || null
export const agenteDe = (req: any) => String(req.headers?.["user-agent"] || "").slice(0, 400)

/** La solicitud del cliente (por su liga secreta). */
export async function solicitudCliente(req: any) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const token = String(req.params.token || "")
  if (token.length < 32) return { knex, s: null }
  await asegurarTablas(knex)
  await asegurarPrivacidad(knex)
  await asegurarSafeDeal(knex)
  return { knex, s: await knex(T_SOLICITUD).where({ token }).first() }
}

/** La solicitud que ganó el taller con sesión (si no la ganó, null). */
export async function solicitudTaller(req: any) {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return { knex, s: null }
  await asegurarTablas(knex)
  await asegurarPrivacidad(knex)
  await asegurarSafeDeal(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s?.propuesta_elegida) return { knex, s: null }
  const p = await knex(T_PROPUESTA).where({ id: s.propuesta_elegida }).first("seller_id")
  return { knex, s: p?.seller_id === sellerId ? s : null }
}

export const NO_ENCONTRADA = { message: "Solicitud no encontrada o todavía sin propuesta elegida." }
