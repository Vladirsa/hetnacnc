import ExcelJS from "exceljs"

import { leerCfdi } from "../conta/cfdi"
import { calcularAnio, type FilaCfdi } from "../conta/motor"
import { categoriaInicial } from "../conta/almacen"
import { exportarExcel, feedCsv, leerMovimientos } from "../conta/excel"
import { RFC_YO, cfdi } from "../conta/__tests__/cfdi-fixtures"

const fila = (xml: string): FilaCfdi => { const c = leerCfdi(xml); const d = c.emisor_rfc === RFC_YO ? "emitido" : "recibido"; return { uuid: c.uuid, direccion: d, tipo: c.tipo, categoria: categoriaInicial(c, d), datos: c } }

describe("Excel de contabilidad", () => {
  const meses = calcularAnio([fila(cfdi({ uuid: "v1", fecha: "2026-01-10T10:00:00", subtotal: 30000, receptor: "EKU9003173C9" }))], [], 2026, 2)

  it("el resumen va primero, con fórmulas y su resultado guardado", async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await exportarExcel({ contribuyente: { rfc: RFC_YO }, anio: 2026, meses })) as any)
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumen", "Ingresos", "Deducciones", "No deducibles", "Sin factura", "Tarifa ISR"])
    const isr: any = wb.getWorksheet("Resumen")!.getCell("G5").value
    expect(isr.formula).toContain("Tarifa ISR")
    expect(isr.result).toBe(meses[0].isr_causado_acum)
    expect(wb.getWorksheet("Tarifa ISR")!.rowCount).toBeGreaterThanOrEqual(133) // 12 × 11 + encabezado
  })

  it("lee la plantilla y señala renglones con error", async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Movimientos")
    ws.addRow(["Fecha", "Tipo", "Concepto", "Subtotal", "IVA"])
    ws.addRow(["2026-03-01", "ingreso", "Mostrador", 500, 80])
    ws.addRow(["01/03/2026", "ingreso", "Fecha mal", 500, 80])
    ws.addRow(["2026-03-02", "venta", "Tipo mal", 500, 80])
    ws.addRow(["2026-03-03", "gasto", "Sin monto", "", 0])
    const r = await leerMovimientos(Buffer.from(await wb.xlsx.writeBuffer()))
    expect(r.movimientos).toEqual([{ fecha: "2026-03-01", tipo: "ingreso", concepto: "Mostrador", subtotal: 500, iva: 80 }])
    expect(r.errores.map((e) => e.fila)).toEqual([3, 4, 5])
  })

  it("el feed CSV trae un renglón por mes", () => {
    const csv = feedCsv(2026, meses).trim().split("\n")
    expect(csv).toHaveLength(3)
    expect(csv[1].startsWith("2026,1,30000,")).toBe(true)
  })
})
