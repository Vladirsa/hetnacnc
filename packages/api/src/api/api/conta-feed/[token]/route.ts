// GET /api/conta-feed/:token?anio=2026  → CSV de solo lectura (Excel "Desde la web" o =IMPORTDATA en Google Sheets)
// El token es largo y se puede cambiar o desactivar desde el dashboard. No expone facturas, sólo totales por mes.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { feedCsv } from "../../../../lib/conta/excel"
import { calcular, contribuyentePorToken } from "../../../../lib/conta/servicio"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyentePorToken(knex, String(req.params.token || ""))
  if (!ctb) return res.status(404).send("Liga no válida o desactivada.")
  const anio = Number(req.query.anio) || new Date().getFullYear()
  try {
    const meses = await calcular(knex, ctb.id, anio)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Cache-Control", "private, max-age=300")
    res.send(feedCsv(anio, meses))
  } catch (e) {
    res.status(400).send((e as Error).message)
  }
}
