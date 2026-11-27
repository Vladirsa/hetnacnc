// POST /store/hetna-social/taller  (Bearer: token de la red con actor "member")
// Entrada de un taller al panel con Google, Facebook o LinkedIn. Todo sale de la
// identidad guardada, nada del navegador. Responde:
//   { accion: "entrar" | "vincular" }          ya tiene cuenta de taller
//   { accion: "nueva", email, first_name, last_name }   va al alta del taller
//   409 { message }                            no se puede (ver decidirTaller)
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { PROVEEDORES_SOCIALES, decidirTaller, nombreDePerfil } from "../../../../lib/auth-social"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const idIdentidad = req.auth_context?.auth_identity_id
  if (!idIdentidad) return res.status(401).json({ message: "Sin sesión de la red social." })
  const auth: any = req.scope.resolve(Modules.AUTH)
  const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")

  const identidad = await auth.retrieveAuthIdentity(idIdentidad, { relations: ["provider_identities"] })
  const pi = (identidad.provider_identities || []).find((p: any) => (PROVEEDORES_SOCIALES as readonly string[]).includes(p.provider))
  if (!pi) return res.status(400).json({ message: "Esta sesión no viene de una red social." })
  const meta = (pi.user_metadata || {}) as Record<string, any>
  const email = String(meta.email || "").trim().toLowerCase()
  const verificado = pi.provider === "google" ? true : meta.email_verified === true

  const idMiembro = (identidad.app_metadata?.member_id as string | undefined) || null
  const miembroDeLaIdentidad = idMiembro ? (await knex("member").where({ id: idMiembro }).whereNull("deleted_at").first("id"))?.id || null : null
  const miembroConEseCorreo = email ? (await knex("member").whereRaw("lower(email) = ?", [email]).whereNull("deleted_at").orderBy("created_at", "asc").first("id"))?.id || null : null

  const d = decidirTaller({ proveedor: pi.provider, email, verificado, miembroDeLaIdentidad, miembroConEseCorreo })
  try {
    if (d.accion === "rechazar") return res.status(409).json({ message: d.motivo })
    if (d.accion === "entrar") return res.json({ accion: "entrar" })
    if (d.accion === "vincular") {
      await auth.updateAuthIdentities([{ id: identidad.id, app_metadata: { ...(identidad.app_metadata || {}), member_id: d.member_id } }])
      logger.info(`[social] ${pi.provider} unida al taller (miembro ${d.member_id})`)
      return res.json({ accion: "vincular" })
    }
    const nombre = nombreDePerfil(meta)
    return res.json({ accion: "nueva", email, first_name: nombre.first_name, last_name: nombre.last_name })
  } catch (e) {
    logger.warn(`[social] taller ${pi.provider}: ${(e as Error).message}`)
    return res.status(400).json({ message: "No se pudo terminar la entrada. Intenta de nuevo o usa tu correo." })
  }
}
