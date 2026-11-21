// Dashboard > Diseños gratis (lib/disenos-gratis.ts)
//   GET  /admin/hetna-disenos-gratis                       -> { pendientes, publicados, temas }
//   POST /admin/hetna-disenos-gratis { id, accion: publicar|descartar }
//   POST /admin/hetna-disenos-gratis { buscar: "tema" }    (buscar más a mano)
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { buscarCandidatos, descartarCandidato, listarCandidatos, publicarCandidato } from "../../../lib/disenos-gratis"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await listarCandidatos(req.scope))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  try {
    if (b.buscar) {
      const nuevos = await buscarCandidatos(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION), String(b.buscar).slice(0, 60), 10)
      return res.json({ nuevos })
    }
    const id = Number(b.id)
    if (!id) return res.status(400).json({ message: "Falta el id." })
    const r = b.accion === "descartar" ? await descartarCandidato(req.scope, id) : await publicarCandidato(req.scope, id)
    res.status(r.ok ? 200 : 400).json(r)
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
