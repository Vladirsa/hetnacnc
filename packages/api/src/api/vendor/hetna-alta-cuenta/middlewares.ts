// Alta de taller (POST /vendor/sellers) sin cuenta de miembro todavía.
//
// Mercur crea el miembro con el `member_email` que manda el navegador y, si ya
// existe un miembro con ese correo, liga la sesión a ESE miembro (upsertMembers).
// Así, cualquiera recién registrado podía mandar el correo de otro taller y quedar
// dentro de su cuenta. Aquí (27 nov 2026):
//   - el correo del miembro nuevo sale de la identidad (con el que se registró o
//     el que dio Google/Facebook/LinkedIn), nunca del navegador
//   - si ya hay un miembro con ese correo, no se da de alta: debe entrar con él
// Un miembro que ya existe (sesión con actor) no cambia: Mercur usa su id.
import { authenticate, type MedusaNextFunction, type MedusaRequest, type MedusaResponse, type MiddlewareRoute } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { correoDeIdentidad } from "../../../lib/auth-social"

type Ctx = { auth_context?: { actor_id?: string; auth_identity_id?: string } }

export async function blindarAltaTaller(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const ctx = (req as unknown as Ctx).auth_context
  if (!ctx?.auth_identity_id) return res.status(401).json({ message: "Inicia sesión para dar de alta tu taller." })
  if (ctx.actor_id) return next()
  try {
    const auth: any = req.scope.resolve(Modules.AUTH)
    const identidad = await auth.retrieveAuthIdentity(ctx.auth_identity_id, { relations: ["provider_identities"] })
    const email = correoDeIdentidad(identidad?.provider_identities)
    if (!email) return res.status(400).json({ message: "Tu cuenta no tiene un correo válido. Regístrate con correo y contraseña." })
    const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const existe = await knex("member").whereRaw("lower(email) = ?", [email]).whereNull("deleted_at").first("id")
    if (existe) return res.status(409).json({ message: `Ya hay un taller con ${email}. Entra con esa cuenta.` })
    const r = req as unknown as { body?: Record<string, unknown>; validatedBody?: Record<string, unknown> }
    if (r.body && typeof r.body === "object") r.body.member_email = email
    if (r.validatedBody && typeof r.validatedBody === "object") r.validatedBody.member_email = email
    next()
  } catch {
    res.status(503).json({ message: "No se pudo dar de alta en este momento. Intenta de nuevo." })
  }
}

export const vendorAltaCuentaMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/vendor/sellers",
    middlewares: [authenticate("member", ["session", "bearer"], { allowUnregistered: true }), blindarAltaTaller],
  },
]
