// GET /admin/hetna-conta/cfdi?anio=2026&mes=3&direccion=recibido&q=texto
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { CATEGORIAS, T_CFDI, contribuyenteHetna } from "../../../../lib/conta/almacen"
import { DEPRECIACION } from "../../../../lib/conta/parametros"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.json({ cfdis: [] })
  const anio = Number(req.query.anio) || new Date().getFullYear()
  const mes = Number(req.query.mes) || 0
  const dir = ["emitido", "recibido"].includes(String(req.query.direccion)) ? String(req.query.direccion) : null
  const q = String(req.query.q || "").trim()
  const filas = await knex(T_CFDI)
    .where({ contribuyente_id: ctb.id })
    .whereRaw("extract(year from fecha) = ?", [anio])
    .modify((x: any) => {
      if (mes) x.whereRaw("extract(month from fecha) = ?", [mes])
      if (dir) x.where({ direccion: dir })
      if (q) x.where((w: any) => w.whereILike("emisor_nombre", `%${q}%`).orWhereILike("receptor_nombre", `%${q}%`).orWhereILike("uuid", `%${q}%`).orWhereILike("emisor_rfc", `%${q}%`).orWhereILike("receptor_rfc", `%${q}%`))
    })
    .orderBy("fecha", "desc")
    .limit(500)
    .select("uuid", "direccion", "tipo", "fecha", "emisor_rfc", "emisor_nombre", "receptor_rfc", "receptor_nombre", "metodo", "forma", "moneda",
      "subtotal_mxn", "total_mxn", "iva_trasladado", "isr_retenido", "iva_retenido", "categoria", "categoria_manual", "tipo_activo", "estatus_sat")
  res.json({
    cfdis: filas.map((f: any) => ({ ...f, subtotal_mxn: Number(f.subtotal_mxn), total_mxn: Number(f.total_mxn), iva_trasladado: Number(f.iva_trasladado), isr_retenido: Number(f.isr_retenido), iva_retenido: Number(f.iva_retenido) })),
    categorias: CATEGORIAS,
    activos: Object.fromEntries(Object.entries(DEPRECIACION).map(([k, v]) => [k, `${Math.round(v.tasa * 100)}% · ${v.fuente}`])),
  })
}
