// "Invita a otro taller" (lib/referidos.ts).
//   GET  /vendor/hetna-referidos        -> { liga, embajador, invitados[] }
//   POST /vendor/hetna-referidos {ref}  -> liga al taller con quien lo invitó
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { servicioTalleres } from "../../../lib/alta-taller"
import { INVITADOS_PARA_EMBAJADOR, ligaInvitacion, ligarReferido, misInvitados } from "../../../lib/referidos"

const idTaller = (req: AuthenticatedMedusaRequest) => (req as any).seller_context?.seller_id as string | undefined

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const t = await servicioTalleres(req.scope).retrieveSeller(sellerId)
  const invitados = await misInvitados(req.scope, sellerId)
  res.json({
    liga: t.handle ? ligaInvitacion(t.handle) : null,
    embajador: t.metadata?.embajador === true,
    para_embajador: INVITADOS_PARA_EMBAJADOR,
    invitados,
  })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const sellerId = idTaller(req)
  if (!sellerId) return res.status(401).json({ message: "Vuelve a iniciar sesión." })
  const r = await ligarReferido(req.scope, sellerId, (req.body as any)?.ref)
  res.status(r.ok ? 200 : 400).json(r)
}
