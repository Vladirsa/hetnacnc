// Dashboard > Planos IA (lib/planos-biblioteca.ts)
//   GET  /admin/hetna-planos                         -> { planos }
//   POST /admin/hetna-planos { importar: Plano }     -> guarda un borrador (revisado por la tienda)
//   POST /admin/hetna-planos { slug, accion: publicar | rechazar }
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorPlano, guardarBorrador, listarBiblioteca, resolverPlano } from "../../../lib/planos-biblioteca"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ planos: await listarBiblioteca(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)) })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    if (b.importar) return res.json(await guardarBorrador(knex, b.importar, { origen: "manual", razon: "Importado a mano desde el panel" }))
    const slug = String(b.slug || "")
    if (!slug) return res.status(400).json({ message: "Falta el plano." })
    res.json(await resolverPlano(req.scope, slug, String(b.accion || "")))
  } catch (e) {
    if (e instanceof ErrorPlano) return res.status(400).json({ message: e.message })
    req.scope.resolve("logger").error(`[hetna-planos] ${(e as Error).message}`)
    res.status(500).json({ message: (e as Error).message })
  }
}
