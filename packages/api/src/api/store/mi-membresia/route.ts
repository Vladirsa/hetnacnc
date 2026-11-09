// GET /store/mi-membresia -> ¿el cliente con sesión tiene Membresía Empresarial?
// (Licitaciones 3.0, Fase 3). Sin sesión responde que no.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { BENEFICIOS_EMPRESARIAL, esMiembroEmpresarial } from "../../../lib/confianza"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const customerId = req.auth_context?.actor_id || null
  const miembro = customerId ? await esMiembroEmpresarial(knex, { customerId }) : false
  res.json({ miembro, sesion: !!customerId, beneficios: BENEFICIOS_EMPRESARIAL })
}
