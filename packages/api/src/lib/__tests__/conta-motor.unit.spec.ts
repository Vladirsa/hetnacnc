import { leerCfdi } from "../conta/cfdi"
import { calcularAnio, type FilaCfdi } from "../conta/motor"
import { categoriaInicial } from "../conta/almacen"
import { isrTarifa } from "../conta/tarifas"
import { RFC_YO, cfdi, rep } from "../conta/__tests__/cfdi-fixtures"

const fila = (xml: string, extra: Partial<FilaCfdi> = {}): FilaCfdi => {
  const c = leerCfdi(xml)
  const direccion = c.emisor_rfc === RFC_YO ? "emitido" : "recibido"
  return { uuid: c.uuid, direccion, tipo: c.tipo, categoria: categoriaInicial(c, direccion), datos: c, ...extra }
}
const PROV = { emisor: "AAA010101AAA", emisorNombre: "PROVEEDOR SA", emisorRegimen: "601", receptor: RFC_YO, receptorRegimen: "612", uso: "G03" }

describe("Tarifa ISR 2026 (Anexo 8)", () => {
  it("enero: renglón 17,533.65 – 35,362.83", () => {
    // 1,856.84 + (19,915 − 17,533.65) × 21.36% = 2,365.50
    expect(isrTarifa(19915, 2026, 1)).toBe(2365.5)
  })
  it("primer renglón y base cero", () => {
    expect(isrTarifa(500, 2026, 1)).toBe(9.6) // 500 × 1.92%
    expect(isrTarifa(0, 2026, 5)).toBe(0)
  })
  it("sin tarifa del año: avisa en vez de inventar", () => {
    expect(() => isrTarifa(1000, 2031, 1)).toThrow(/Anexo 8/)
  })
})

describe("Motor ISR / IVA", () => {
  const filas: FilaCfdi[] = [
    fila(cfdi({ uuid: "v1", fecha: "2026-01-10T10:00:00", subtotal: 30000, receptor: "EKU9003173C9", receptorRegimen: "601" })),
    fila(cfdi({ uuid: "g1", fecha: "2026-01-12T10:00:00", subtotal: 10000, forma: "03", ...PROV })),
    fila(cfdi({ uuid: "g2", fecha: "2026-01-13T10:00:00", subtotal: 3000, forma: "01", ...PROV, descripcion: "Material MDF" })),
    fila(cfdi({ uuid: "g3", fecha: "2026-01-14T10:00:00", subtotal: 1000, forma: "04", ...PROV, descripcion: "Consumo de alimentos en restaurante", claveProd: "90101501" })),
    fila(cfdi({ uuid: "pc", fecha: "2026-01-20T10:00:00", subtotal: 20000, forma: "03", ...PROV, uso: "I04", descripcion: "Laptop", claveProd: "43211503" })),
    fila(cfdi({ uuid: "v2", fecha: "2026-02-05T10:00:00", subtotal: 20000, metodo: "PPD", forma: "99", receptor: "EKU9003173C9", receptorRegimen: "601" })),
    fila(rep({ uuid: "p1", fechaPago: "2026-03-08T10:00:00", doc: "V2", pagado: 11600, saldoAnt: 23200 })),
    fila(cfdi({ uuid: "x1", fecha: "2026-01-25T10:00:00", subtotal: 99999, receptor: "EKU9003173C9" }), { estatus_sat: "cancelado" }),
  ]
  const m = calcularAnio(filas, [{ fecha: "2026-03-20", tipo: "ingreso", concepto: "Venta de mostrador sin factura", subtotal: 1000, iva: 160 }], 2026, 3)

  it("enero: ingresos, deducciones con reglas y cancelada fuera", () => {
    expect(m[0].ingresos).toBe(30000) // la cancelada no cuenta
    expect(m[0].deducciones).toBe(10085) // 10,000 + 8.5% de 1,000; efectivo de 3,000 fuera
    expect(m[0].detalle.no_deducibles.map((n) => n.uuid).sort()).toEqual(["G2", "G3"])
    expect(m[0].depreciacion).toBe(0) // la laptop se deprecia desde febrero
    expect(m[0].isr_a_pagar).toBe(2365.5)
  })

  it("enero IVA: la inversión se acredita al pagarse y deja saldo a favor", () => {
    // 4,800 − (1,600 + 13.60 + 3,200) = −13.60
    expect(m[0].iva_acreditable).toBe(4813.6)
    expect(m[0].iva_a_pagar).toBe(0)
    expect(m[0].iva_saldo_favor).toBe(13.6)
  })

  it("febrero: la venta PPD no cuenta hasta que se cobra; depreciación 30% anual", () => {
    expect(m[1].ingresos).toBe(0)
    expect(m[1].depreciacion).toBe(500) // 20,000 × 30% / 12
    expect(m[1].base_acum).toBe(19415)
    // ISR acumulado de febrero menos el pago de enero (si sale negativo, cero)
    expect(m[1].isr_a_pagar).toBe(Math.max(0, Math.round((isrTarifa(19415, 2026, 2) - 2365.5) * 100) / 100))
  })

  it("marzo: el REP cobra la mitad (base 10,000) y se aplica el saldo a favor de IVA", () => {
    expect(m[2].ingresos).toBe(11000) // 10,000 del REP + 1,000 sin factura
    expect(m[2].iva_trasladado).toBe(1760)
    expect(m[2].iva_favor_aplicado).toBe(13.6)
    expect(m[2].iva_a_pagar).toBe(1746.4)
    expect(m[2].detalle.sin_factura).toHaveLength(1)
  })
})
