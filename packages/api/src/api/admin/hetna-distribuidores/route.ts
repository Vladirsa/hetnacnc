// HETNA Panel → Distribuidores (sólo administradores).
//   GET  /admin/hetna-distribuidores → { instalado, codigos, meses_a_favor, referidos }
//   POST /admin/hetna-distribuidores { accion: crear|activar|desactivar|mes_aplicado, ... }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { accionDistribuidores, ErrorDistribuidor, panelDistribuidores } from "../../../lib/distribuidores"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await panelDistribuidores())
  } catch (e) {
    res.status(502).json({ message: `No se pudo leer: ${(e as Error).message}` })
  }
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  try {
    res.json(await accionDistribuidores(req.body))
  } catch (e) {
    if (e instanceof ErrorDistribuidor) return res.status(e.status).json({ message: e.message })
    res.status(502).json({ message: `No se pudo: ${(e as Error).message}` })
  }
}
