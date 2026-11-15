// Excel del departamento de contabilidad, en tres formas:
//   1. exportarExcel: libro con fórmulas vivas (si cambias una cifra, el ISR y el
//      IVA se recalculan) y la tarifa oficial en su propia hoja.
//   2. plantillaMovimientos / leerMovimientos: subir cobros y gastos sin factura.
//   3. feedCsv: CSV de solo lectura para Excel (Datos > Desde la web) o Google
//      Sheets (=IMPORTDATA("liga")) que se actualiza solo.
import ExcelJS from "exceljs"

import type { Mes, Movimiento } from "./motor"
import { FUENTE_TARIFA, TARIFA_106 } from "./tarifas"

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const PESOS = '"$"#,##0.00'
const AZUL = "FF142033"

function encabezado(ws: ExcelJS.Worksheet, columnas: { titulo: string; ancho: number; pesos?: boolean }[]) {
  ws.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho, style: c.pesos ? { numFmt: PESOS } : {} }))
  const fila = ws.getRow(1)
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } }
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } }
  ws.views = [{ state: "frozen", ySplit: 1 }]
}

export async function exportarExcel(p: { contribuyente: { rfc: string; nombre?: string | null }; anio: number; meses: Mes[] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "HETNA CNC · Contabilidad"
  wb.created = new Date()
  const { anio, meses } = p

  // El resumen va primero; se llena al final
  const ws = wb.addWorksheet("Resumen")

  // ── Ingresos y deducciones (detalle, editable) ──
  const wsI = wb.addWorksheet("Ingresos")
  encabezado(wsI, [
    { titulo: "Mes", ancho: 6 }, { titulo: "Fecha", ancho: 11 }, { titulo: "UUID", ancho: 38 }, { titulo: "RFC cliente", ancho: 15 },
    { titulo: "Cliente", ancho: 30 }, { titulo: "Concepto", ancho: 36 }, { titulo: "Base (sin IVA)", ancho: 15, pesos: true },
    { titulo: "IVA", ancho: 13, pesos: true }, { titulo: "ISR retenido", ancho: 13, pesos: true }, { titulo: "IVA retenido", ancho: 13, pesos: true },
  ])
  const wsD = wb.addWorksheet("Deducciones")
  encabezado(wsD, [
    { titulo: "Mes", ancho: 6 }, { titulo: "Fecha", ancho: 11 }, { titulo: "UUID", ancho: 38 }, { titulo: "RFC proveedor", ancho: 15 },
    { titulo: "Proveedor", ancho: 30 }, { titulo: "Concepto", ancho: 40 }, { titulo: "Deducible (sin IVA)", ancho: 17, pesos: true },
    { titulo: "IVA acreditable", ancho: 15, pesos: true }, { titulo: "Nota", ancho: 50 },
  ])
  const wsN = wb.addWorksheet("No deducibles")
  encabezado(wsN, [
    { titulo: "Mes", ancho: 6 }, { titulo: "Fecha", ancho: 11 }, { titulo: "UUID", ancho: 38 }, { titulo: "Proveedor", ancho: 30 },
    { titulo: "Base", ancho: 13, pesos: true }, { titulo: "IVA", ancho: 13, pesos: true }, { titulo: "Motivo", ancho: 60 },
  ])
  const wsS = wb.addWorksheet("Sin factura")
  encabezado(wsS, [
    { titulo: "Mes", ancho: 6 }, { titulo: "Fecha", ancho: 11 }, { titulo: "Tipo", ancho: 9 }, { titulo: "Concepto", ancho: 40 },
    { titulo: "Subtotal", ancho: 13, pesos: true }, { titulo: "IVA", ancho: 13, pesos: true },
  ])
  for (const m of meses) {
    for (const x of m.detalle.ingresos) wsI.addRow([m.mes, x.fecha, x.uuid, x.rfc, x.nombre, x.concepto, x.base, x.iva, x.isr_ret, x.iva_ret])
    for (const x of m.detalle.deducciones) wsD.addRow([m.mes, x.fecha, x.uuid, x.rfc, x.nombre, x.concepto, x.base, x.iva, x.nota || ""])
    for (const x of m.detalle.no_deducibles) wsN.addRow([m.mes, x.fecha, x.uuid, x.nombre, x.base, x.iva, x.motivo])
    for (const x of m.detalle.sin_factura) wsS.addRow([m.mes, x.fecha, x.tipo, x.concepto, x.subtotal, x.iva])
  }

  // ── Tarifa oficial (12 bloques de 11 renglones) ──
  const wsT = wb.addWorksheet("Tarifa ISR")
  encabezado(wsT, [
    { titulo: "Límite inferior", ancho: 16, pesos: true }, { titulo: "Límite superior", ancho: 16, pesos: true },
    { titulo: "Cuota fija", ancho: 14, pesos: true }, { titulo: "% excedente", ancho: 12 }, { titulo: "Mes", ancho: 12 },
  ])
  const tarifas = TARIFA_106[anio]
  for (let mes = 1; mes <= 12; mes++) for (const r of tarifas?.[mes] || []) wsT.addRow([r[0], r[1] ?? "En adelante", r[2], r[3], MESES[mes - 1]])
  wsT.addRow([])
  wsT.addRow([`Fuente: ${FUENTE_TARIFA[anio] || "sin tarifa cargada"}`])

  // ── Resumen con fórmulas ──
  ws.getCell("A1").value = `Contabilidad ${anio} · ${p.contribuyente.nombre || ""} · RFC ${p.contribuyente.rfc}`
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: AZUL } }
  ws.getCell("A2").value = "Borrador para tu contador (régimen 612, base de flujo). No se presenta solo ante el SAT. Las cifras de las otras hojas se pueden corregir: este resumen se recalcula."
  ws.getCell("A2").font = { italic: true, color: { argb: "FF6B6A63" } }
  const cols = ["Mes", "Ingresos", "Deducciones", "Ingresos acum.", "Deducciones acum.", "Base ISR acum.", "ISR causado acum.", "Pagos previos", "ISR retenido acum.", "ISR a pagar",
    "IVA trasladado", "IVA retenido", "IVA acreditable", "Saldo IVA del mes", "Saldo a favor aplicado", "IVA a pagar", "Saldo a favor siguiente"]
  const filaTit = ws.getRow(4)
  cols.forEach((c, i) => { filaTit.getCell(i + 1).value = c })
  filaTit.font = { bold: true, color: { argb: "FFFFFFFF" } }
  filaTit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } }
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 12 : 16 })
  ws.views = [{ state: "frozen", ySplit: 4, xSplit: 1 }]

  meses.forEach((m, i) => {
    const r = 5 + i
    const prev = r - 1
    const primera = i === 0
    const v = (f: string, resultado: number) => ({ formula: f, result: resultado })
    const tramo = `OFFSET('Tarifa ISR'!$A$2,${(m.mes - 1) * 11},0,11,4)`
    const fila = ws.getRow(r)
    fila.getCell(1).value = MESES[m.mes - 1]
    fila.getCell(2).value = v(`SUMIFS(Ingresos!G:G,Ingresos!A:A,${m.mes})+SUMIFS('Sin factura'!E:E,'Sin factura'!A:A,${m.mes},'Sin factura'!C:C,"ingreso")`, m.ingresos)
    fila.getCell(3).value = v(`SUMIFS(Deducciones!G:G,Deducciones!A:A,${m.mes})`, r2(m.deducciones + m.depreciacion))
    fila.getCell(4).value = v(primera ? `B${r}` : `D${prev}+B${r}`, m.ingresos_acum)
    fila.getCell(5).value = v(primera ? `C${r}` : `E${prev}+C${r}`, m.deducciones_acum)
    fila.getCell(6).value = v(`MAX(0,D${r}-E${r})`, m.base_acum)
    fila.getCell(7).value = v(`IF(F${r}<=0,0,ROUND(VLOOKUP(F${r},${tramo},3,TRUE)+(F${r}-VLOOKUP(F${r},${tramo},1,TRUE))*VLOOKUP(F${r},${tramo},4,TRUE)/100,2))`, m.isr_causado_acum)
    fila.getCell(8).value = v(primera ? "0" : `SUM($J$5:J${prev})`, m.isr_pagos_previos)
    fila.getCell(9).value = v(`SUMIFS(Ingresos!I:I,Ingresos!A:A,"<="&${m.mes})`, m.isr_retenido_acum)
    fila.getCell(10).value = v(`MAX(0,G${r}-H${r}-I${r})`, m.isr_a_pagar)
    fila.getCell(11).value = v(`SUMIFS(Ingresos!H:H,Ingresos!A:A,${m.mes})+SUMIFS('Sin factura'!F:F,'Sin factura'!A:A,${m.mes},'Sin factura'!C:C,"ingreso")`, m.iva_trasladado)
    fila.getCell(12).value = v(`SUMIFS(Ingresos!J:J,Ingresos!A:A,${m.mes})`, m.iva_retenido)
    fila.getCell(13).value = v(`SUMIFS(Deducciones!H:H,Deducciones!A:A,${m.mes})`, m.iva_acreditable)
    fila.getCell(14).value = v(`K${r}-L${r}-M${r}`, m.iva_saldo_mes)
    fila.getCell(15).value = v(primera ? "0" : `IF(N${r}>0,MIN(N${r},Q${prev}),0)`, m.iva_favor_aplicado)
    fila.getCell(16).value = v(`MAX(0,N${r}-O${r})`, m.iva_a_pagar)
    fila.getCell(17).value = v(primera ? `IF(N${r}<0,-N${r},0)` : `Q${prev}-O${r}+IF(N${r}<0,-N${r},0)`, m.iva_saldo_favor)
    for (let c = 2; c <= 17; c++) fila.getCell(c).numFmt = PESOS
  })
  const total = 5 + meses.length
  ws.getCell(`A${total}`).value = "Total"
  ws.getCell(`A${total}`).font = { bold: true }
  for (const col of ["B", "C", "J", "K", "L", "M", "P"]) {
    ws.getCell(`${col}${total}`).value = { formula: `SUM(${col}5:${col}${total - 1})` }
    ws.getCell(`${col}${total}`).numFmt = PESOS
    ws.getCell(`${col}${total}`).font = { bold: true }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Plantilla para subir cobros y gastos que no tienen factura. */
export async function plantillaMovimientos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Movimientos")
  encabezado(ws, [
    { titulo: "Fecha (AAAA-MM-DD)", ancho: 18 }, { titulo: "Tipo (ingreso o gasto)", ancho: 20 },
    { titulo: "Concepto", ancho: 40 }, { titulo: "Subtotal (sin IVA)", ancho: 18, pesos: true }, { titulo: "IVA", ancho: 12, pesos: true },
  ])
  ws.addRow(["2026-11-03", "ingreso", "Venta de mostrador sin factura", 1000, 160])
  ws.addRow(["2026-11-04", "gasto", "Propina / gasto menor sin factura", 150, 0])
  const n = wb.addWorksheet("Instrucciones")
  n.getColumn(1).width = 110
  for (const t of [
    "Un renglón por movimiento. Borra los dos de ejemplo.",
    "ingreso: cobros que no facturaste (sí pagan ISR e IVA). Si después emites la factura global, no lo dupliques.",
    "gasto: sólo para tu control. Un gasto sin factura NO es deducible (art. 27 fr. III LISR).",
    "Las facturas (XML) no se suben aquí: súbelas en la pestaña Facturas o se descargan del SAT.",
  ]) n.addRow([t])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export type ErrorFila = { fila: number; error: string }

/** Lee la plantilla llena. Devuelve los movimientos válidos y los renglones con error. */
export async function leerMovimientos(datos: Buffer): Promise<{ movimientos: Movimiento[]; errores: ErrorFila[] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(datos as any)
  const ws = wb.worksheets[0]
  const movimientos: Movimiento[] = []
  const errores: ErrorFila[] = []
  const celda = (v: any) => (v && typeof v === "object" && "result" in v ? v.result : v && typeof v === "object" && "text" in v ? v.text : v)
  ws.eachRow((row, n) => {
    if (n === 1) return
    const [fechaV, tipoV, conceptoV, subV, ivaV] = [1, 2, 3, 4, 5].map((c) => celda(row.getCell(c).value))
    if ([fechaV, tipoV, conceptoV, subV].every((x) => x === null || x === undefined || x === "")) return
    const fecha = fechaV instanceof Date ? fechaV.toISOString().slice(0, 10) : String(fechaV || "").trim().slice(0, 10)
    const tipo = String(tipoV || "").trim().toLowerCase()
    const subtotal = Number(subV)
    const iva = ivaV === null || ivaV === undefined || ivaV === "" ? 0 : Number(ivaV)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return void errores.push({ fila: n, error: "La fecha debe ir como AAAA-MM-DD" })
    if (tipo !== "ingreso" && tipo !== "gasto") return void errores.push({ fila: n, error: 'El tipo debe ser "ingreso" o "gasto"' })
    if (!Number.isFinite(subtotal) || subtotal <= 0) return void errores.push({ fila: n, error: "El subtotal debe ser un número mayor a cero" })
    if (!Number.isFinite(iva) || iva < 0) return void errores.push({ fila: n, error: "El IVA debe ser un número (0 si no lleva)" })
    movimientos.push({ fecha, tipo, concepto: String(conceptoV || "").trim().slice(0, 200) || "(sin concepto)", subtotal: r2(subtotal), iva: r2(iva) })
  })
  return { movimientos, errores }
}

/** CSV para Excel / Google Sheets conectados: un renglón por mes. */
export function feedCsv(anio: number, meses: Mes[]): string {
  const cab = ["anio", "mes", "ingresos", "deducciones", "depreciacion", "base_isr_acum", "isr_a_pagar", "iva_trasladado", "iva_retenido", "iva_acreditable", "iva_a_pagar", "iva_saldo_favor"]
  const filas = meses.map((m) => [anio, m.mes, m.ingresos, m.deducciones, m.depreciacion, m.base_acum, m.isr_a_pagar, m.iva_trasladado, m.iva_retenido, m.iva_acreditable, m.iva_a_pagar, m.iva_saldo_favor].join(","))
  return [cab.join(","), ...filas].join("\n") + "\n"
}
