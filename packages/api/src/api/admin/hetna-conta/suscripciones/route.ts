// GET  /admin/hetna-conta/suscripciones → cobros de suscripciones del Cotizador y su CFDI
// POST /admin/hetna-conta/suscripciones { cobro_id } → reintentar ese cobro
//      { global: { anio, mes } } → emitir la factura global de ese mes
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cobrosRecientes, facturaGlobalDelMes, facturacionLista, facturarCobro } from "../../../../lib/cotizador-facturacion"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const lista = await facturacionLista(knex)
  const cobros = (await cobrosRecientes(knex)).map((c: any) => ({ ...c, monto: Number(c.monto) }))
  res.json({ lista: lista.ok, motivo: lista.ok ? null : lista.motivo, cobros })
}

export const POST = async (req: AuthenticatedMedusaRequest<{ cobro_id?: string; global?: { anio?: number; mes?: number } }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger")
  const b = (req.body || {}) as any
  if (b.global) {
    const anio = Number(b.global.anio), mes = Number(b.global.mes)
    if (!(anio > 2020 && mes >= 1 && mes <= 12)) return res.status(400).json({ message: "Mes no válido." })
    return res.json(await facturaGlobalDelMes(knex, anio, mes, { logger }))
  }
  const id = String(b.cobro_id || "")
  if (!/^(mp|pp|st):[A-Za-z0-9_-]{4,100}$/.test(id)) return res.status(400).json({ message: "Cobro no válido." })
  res.json(await facturarCobro(knex, id, { logger }))
}
