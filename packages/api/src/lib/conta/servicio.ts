// Une almacén + motor: lo que usan las rutas del dashboard, el feed de Excel y el auditor.
import { randomBytes } from "crypto"

import { T_CFDI, T_CONTRIBUYENTE, T_MOVIMIENTO, asegurarConta } from "./almacen"
import { calcularAnio, type FilaCfdi, type Movimiento } from "./motor"

const parsear = (d: any) => (typeof d === "string" ? JSON.parse(d) : d)

/**
 * Facturas que importan para el año: las del año y, de años anteriores, las
 * inversiones (siguen depreciándose) y las PPD (su pago puede caer este año).
 */
export async function filasDelAnio(knex: any, contribuyenteId: string, anio: number): Promise<FilaCfdi[]> {
  const filas = (await knex(T_CFDI)
    .where({ contribuyente_id: contribuyenteId })
    .where("fecha", "<", `${anio + 1}-01-01`)
    .where((q: any) =>
      q.where("fecha", ">=", `${anio}-01-01`).orWhere({ categoria: "inversion" }).orWhere({ metodo: "PPD" })
    )
    .select("uuid", "direccion", "tipo", "categoria", "tipo_activo", "estatus_sat", "datos")) as any[]
  return filas.map((f) => ({ ...f, datos: parsear(f.datos) }))
}

export async function movimientosDelAnio(knex: any, contribuyenteId: string, anio: number): Promise<Movimiento[]> {
  const filas = (await knex(T_MOVIMIENTO)
    .where({ contribuyente_id: contribuyenteId })
    .whereBetween("fecha", [`${anio}-01-01`, `${anio}-12-31`])
    .select("fecha", "tipo", "concepto", "subtotal", "iva")) as any[]
  return filas.map((m) => ({
    fecha: typeof m.fecha === "string" ? m.fecha.slice(0, 10) : new Date(m.fecha).toISOString().slice(0, 10),
    tipo: m.tipo, concepto: m.concepto, subtotal: Number(m.subtotal), iva: Number(m.iva),
  }))
}

/** Meses calculados hasta el mes actual (o diciembre si el año ya pasó). */
export async function calcular(knex: any, contribuyenteId: string, anio: number, ahora = new Date()) {
  const hasta = anio < ahora.getFullYear() ? 12 : anio > ahora.getFullYear() ? 0 : ahora.getMonth() + 1
  if (!hasta) return []
  const [filas, movs] = await Promise.all([filasDelAnio(knex, contribuyenteId, anio), movimientosDelAnio(knex, contribuyenteId, anio)])
  return calcularAnio(filas, movs, anio, hasta)
}

/** Liga de solo lectura para Excel / Google Sheets: token largo, se puede revocar. */
export async function nuevoTokenExcel(knex: any, contribuyenteId: string) {
  await asegurarConta(knex)
  const token = randomBytes(24).toString("base64url")
  await knex(T_CONTRIBUYENTE).where({ id: contribuyenteId }).update({ token_excel: token })
  return token
}
export async function revocarTokenExcel(knex: any, contribuyenteId: string) {
  await knex(T_CONTRIBUYENTE).where({ id: contribuyenteId }).update({ token_excel: null })
}
export async function contribuyentePorToken(knex: any, token: string) {
  if (!token || token.length < 30) return null
  await asegurarConta(knex)
  return knex(T_CONTRIBUYENTE).where({ token_excel: token }).first()
}

/** Guarda movimientos de Excel. Evita duplicar el mismo renglón si se sube dos veces el archivo. */
export async function guardarMovimientos(knex: any, contribuyenteId: string, movs: Movimiento[]) {
  await asegurarConta(knex)
  let nuevos = 0, repetidos = 0
  for (const m of movs) {
    const ya = await knex(T_MOVIMIENTO).where({ contribuyente_id: contribuyenteId, fecha: m.fecha, tipo: m.tipo, concepto: m.concepto, subtotal: m.subtotal }).first("id")
    if (ya) { repetidos++; continue }
    await knex(T_MOVIMIENTO).insert({ id: `mov_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`, contribuyente_id: contribuyenteId, ...m })
    nuevos++
  }
  return { nuevos, repetidos }
}
