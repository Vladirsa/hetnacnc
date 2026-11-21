import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** Correo y nombre del cliente con sesión (para el permiso de Fase 1 y los avisos). */
export async function clienteDe(req: AuthenticatedMedusaRequest) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [c] } = await query.graph({ entity: "customer", fields: ["email", "first_name", "last_name"], filters: { id: req.auth_context.actor_id } })
    const x = (c || {}) as { email?: string; first_name?: string; last_name?: string }
    return { correo: x.email || null, nombre: [x.first_name, x.last_name].filter(Boolean).join(" ") || null }
  } catch {
    return { correo: null, nombre: null }
  }
}

export const knexDe = (req: AuthenticatedMedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
