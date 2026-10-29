// GET /store/foro/mi-taller
// ¿El correo del cliente con sesión es el de un taller registrado? Si sí,
// su perfil del foro se puede ligar a ese taller (insignia de taller y liga a
// su perfil en el directorio). Sólo responde por el propio cliente: así nadie
// averigua qué correos son de talleres.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const clienteId = req.auth_context.actor_id
  const cliente = await knex("customer").where({ id: clienteId }).whereNull("deleted_at").first("email")
  const correo = String(cliente?.email || "").trim().toLowerCase()
  if (!correo) return res.json({ taller: null })

  // El correo del taller, o el de cualquiera de sus miembros del panel.
  const taller =
    (await knex("seller").whereRaw("lower(email) = ?", [correo]).whereNull("deleted_at").first("id", "handle", "name", "metadata")) ||
    (await knex("seller as s")
      .join("seller_member as sm", "sm.seller_id", "s.id")
      .join("member as m", "m.id", "sm.member_id")
      .whereRaw("lower(m.email) = ?", [correo])
      .whereNull("s.deleted_at")
      .whereNull("sm.deleted_at")
      .whereNull("m.deleted_at")
      .first("s.id", "s.handle", "s.name", "s.metadata"))

  if (!taller) return res.json({ taller: null })
  res.json({
    taller: { id: taller.id, handle: taller.handle, nombre: taller.name, verificado: taller.metadata?.verificado === true },
  })
}
