// GET  /admin/hetna-conta?anio=2026  → contribuyente, meses calculados y conteos
// POST /admin/hetna-conta            { rfc, nombre?, regimen?, cp? } → datos fiscales de HETNA
//
// Departamento de contabilidad (lib/conta). Es un borrador para el contador: no presenta nada al SAT.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { RFC_VALIDO, T_CFDI, T_HALLAZGO, contribuyenteHetna } from "../../../lib/conta/almacen"
import { calcular } from "../../../lib/conta/servicio"

const sinDetalle = (m: any) => ({ ...m, detalle: { ingresos: m.detalle.ingresos.length, deducciones: m.detalle.deducciones.length, no_deducibles: m.detalle.no_deducibles, sin_factura: m.detalle.sin_factura.length } })

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return res.json({ contribuyente: null })
  const anio = Number(req.query.anio) || new Date().getFullYear()
  let meses: any[] = []
  let error: string | null = null
  try {
    meses = (await calcular(knex, ctb.id, anio)).map(sinDetalle)
  } catch (e) {
    error = (e as Error).message // p. ej. no hay tarifa cargada para ese año
  }
  const conteos = (await knex(T_CFDI).where({ contribuyente_id: ctb.id }).whereRaw("extract(year from fecha) = ?", [anio])
    .groupBy("direccion").select("direccion").count("* as n")) as any[]
  const hallazgos = (await knex(T_HALLAZGO).where({ contribuyente_id: ctb.id, estado: "abierto" }).groupBy("severidad").select("severidad").count("* as n")) as any[]
  res.json({
    contribuyente: { rfc: ctb.rfc, nombre: ctb.nombre, regimen: ctb.regimen, cp: ctb.cp, excel_conectado: Boolean(ctb.token_excel) },
    anio, meses, error,
    facturas: Object.fromEntries(conteos.map((c) => [c.direccion, Number(c.n)])),
    hallazgos: Object.fromEntries(hallazgos.map((h) => [h.severidad, Number(h.n)])),
  })
}

export const POST = async (req: AuthenticatedMedusaRequest<{ rfc?: string; nombre?: string; regimen?: string; cp?: string }>, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const rfc = String(b.rfc || "").toUpperCase().trim()
  if (!RFC_VALIDO.test(rfc)) return res.status(400).json({ message: "Escribe un RFC válido (13 caracteres para persona física)." })
  const regimen = ["612", "626"].includes(String(b.regimen)) ? String(b.regimen) : "612"
  if (regimen === "626") return res.status(400).json({ message: "Por ahora el cálculo es para el régimen 612 (actividad empresarial). RESICO viene después." })
  const cp = b.cp ? String(b.cp).replace(/\D/g, "").slice(0, 5) : undefined
  const ctb = await contribuyenteHetna(knex, { rfc, nombre: b.nombre ? String(b.nombre).slice(0, 200) : undefined, regimen, cp })
  res.json({ ok: true, contribuyente: { rfc: ctb.rfc, nombre: ctb.nombre, regimen: ctb.regimen, cp: ctb.cp } })
}
