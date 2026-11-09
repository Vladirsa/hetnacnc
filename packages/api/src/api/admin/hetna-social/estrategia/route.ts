// GET/POST /admin/hetna-social/estrategia -> guías por red, públicos y mercados (Marketing HETNA).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { GUIAS, PUBLICOS, REDES_MERCADO, guardarEstrategia, guiaDe, leerEstrategia, publicoDe } from "../../../../lib/estrategia"
import { MERCADOS, REDES } from "../../../../lib/social-hub"

const vista = async (knex: any) => {
  const cfg = await leerEstrategia(knex)
  return {
    config: cfg,
    guias: Object.keys(GUIAS).map((red) => ({ ...guiaDe(cfg, red), nombre: (REDES as any)[red]?.nombre || red, auto: !!(REDES as any)[red]?.auto, base: GUIAS[red] })),
    publicos: PUBLICOS.map((p) => publicoDe(cfg, p.clave)),
    mercados: Object.entries(MERCADOS).map(([clave, m]) => ({ clave, ...m, pct: cfg.mercados[clave] || 0, redes: REDES_MERCADO[clave] || [] })),
  }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await vista(req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)))
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await guardarEstrategia(knex, (req.body || {}) as any)
  res.json(await vista(knex))
}
