// Dashboard > Planos IA (lib/planos-biblioteca.ts)
//   GET  /admin/hetna-planos                         -> { planos }
//   POST /admin/hetna-planos { importar: Plano }     -> guarda un borrador (revisado por la tienda)
//   POST /admin/hetna-planos { slug, accion: publicar | rechazar }
//   POST /admin/hetna-planos { generar: true, cuantos? }  -> corre el agente en segundo plano
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { correrAgentePlanos, hayIaPlanos, ultimaCorrida } from "../../../lib/planos-agente"
import { ErrorPlano, guardarBorrador, listarBiblioteca, resolverPlano } from "../../../lib/planos-biblioteca"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  res.json({ planos: await listarBiblioteca(knex), agente: { ...(await ultimaCorrida(knex)), ia: hayIaPlanos() } })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const b = (req.body || {}) as Record<string, any>
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    // "Generar ahora": corre en segundo plano (tarda varios minutos)
    if (b.generar) {
      void correrAgentePlanos(req.scope, { cuantos: Number(b.cuantos) || undefined }).catch((e) => req.scope.resolve("logger").error(`[planos-agente] ${(e as Error).message}`))
      return res.json({ iniciado: true })
    }
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
