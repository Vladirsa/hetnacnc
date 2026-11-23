import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { supabaseListo } from "../../../lib/cotizador-suscripciones"
import { ErrorProveedor, correoDeProveedor } from "../../../lib/proveedor-panel"

/** Correo confirmado del cliente con sesión, o null si no se puede confiar en él. */
export async function correoConfirmadoDe(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [c] } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account", "created_at", "metadata"],
    filters: { id: req.auth_context.actor_id },
  })
  return { correo: correoDeProveedor((c || null) as any), email: ((c as any)?.email as string) || null }
}

export function responderError(res: MedusaResponse, e: unknown, que: string) {
  if (e instanceof ErrorProveedor) return res.status(e.status).json({ message: e.message })
  console.error(`[proveedor] ${que}`, e)
  return res.status(502).json({ message: "No pudimos leer las órdenes en este momento. Intenta en unos minutos." })
}

export const listo = () => supabaseListo()
