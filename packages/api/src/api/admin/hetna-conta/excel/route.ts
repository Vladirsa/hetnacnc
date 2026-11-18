// GET /admin/hetna-conta/excel?anio=2026 → libro con fórmulas vivas
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna } from "../../../../lib/conta/almacen"
import { exportarExcel } from "../../../../lib/conta/excel"
import { calcular } from "../../../../lib/conta/servicio"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.status(409).json({ message: "Primero captura tu RFC." })
  const anio = Number(req.query.anio) || new Date().getFullYear()
  try {
    const meses = await calcular(knex, ctb.id, anio)
    const xlsx = await exportarExcel({ contribuyente: ctb, anio, meses })
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="contabilidad-${ctb.rfc}-${anio}.xlsx"`)
    res.send(xlsx)
  } catch (e) {
    res.status(400).json({ message: (e as Error).message })
  }
}
