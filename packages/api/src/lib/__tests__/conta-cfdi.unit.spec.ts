import { ErrorCfdi, leerCfdi } from "../conta/cfdi"
import { RFC_YO, cfdi, rep } from "../conta/__tests__/cfdi-fixtures"

describe("Lector de CFDI", () => {
  it("ingreso PUE 4.0 con IVA 16%", () => {
    const c = leerCfdi(cfdi({ uuid: "aaaaaaaa-0000-0000-0000-000000000001", subtotal: 1000 }))
    expect(c.uuid).toBe("AAAAAAAA-0000-0000-0000-000000000001")
    expect(c.tipo).toBe("I")
    expect(c.metodo).toBe("PUE")
    expect(c.emisor_rfc).toBe(RFC_YO)
    expect(c.impuestos.iva_trasladado).toBe(160)
    expect(c.impuestos.iva_tasa).toBe(0.16)
    expect(c.total_mxn).toBe(1160)
    expect(c.conceptos[0].descripcion).toContain("CNC")
  })

  it("retenciones de persona moral (ISR 10% e IVA 2/3)", () => {
    const c = leerCfdi(cfdi({ uuid: "u2", subtotal: 1000, isrRet: 100, ivaRet: 106.67, receptor: "EKU9003173C9" }))
    expect(c.impuestos.isr_retenido).toBe(100)
    expect(c.impuestos.iva_retenido).toBe(106.67)
    expect(c.total).toBe(953.33)
  })

  it("factura en dólares: importes en pesos con el tipo de cambio", () => {
    const c = leerCfdi(cfdi({ uuid: "u3", moneda: "USD", tc: 18.5, subtotal: 100 }))
    expect(c.subtotal_mxn).toBe(1850)
    expect(c.impuestos.iva_trasladado).toBe(296)
  })

  it("exento: sin IVA y marcado", () => {
    const c = leerCfdi(cfdi({ uuid: "u4", iva: "exento" }))
    expect(c.impuestos.iva_trasladado).toBe(0)
    expect(c.impuestos.iva_exento).toBe(true)
  })

  it("nota de crédito con su CFDI relacionado", () => {
    const c = leerCfdi(cfdi({ uuid: "u5", tipo: "E", subtotal: 200, relacion: { tipo: "01", uuid: "aaaaaaaa-0000-0000-0000-000000000001" } }))
    expect(c.tipo).toBe("E")
    expect(c.relacionados).toEqual([{ tipo: "01", uuid: "AAAAAAAA-0000-0000-0000-000000000001" }])
  })

  it("complemento de pago 2.0: documento pagado con base e IVA", () => {
    const c = leerCfdi(rep({ uuid: "u6", fechaPago: "2026-11-03T12:00:00", doc: "dddd", pagado: 580, saldoAnt: 1160 }))
    expect(c.tipo).toBe("P")
    expect(c.pagos).toHaveLength(1)
    const d = c.pagos[0].doctos[0]
    expect(d.uuid).toBe("DDDD")
    expect(d.pagado).toBe(580)
    expect(d.saldo_insoluto).toBe(580)
    expect(d.base_iva).toBe(500)
    expect(d.iva).toBe(80)
  })

  it("CFDI 3.3 también se lee", () => {
    const c = leerCfdi(cfdi({ uuid: "u7", version: "3.3" }))
    expect(c.version).toBe("3.3")
    expect(c.impuestos.iva_trasladado).toBe(160)
  })

  it("rechaza lo que no es un CFDI timbrado", () => {
    expect(() => leerCfdi("<hola/>")).toThrow(ErrorCfdi)
    expect(() => leerCfdi(cfdi({ uuid: "" }))).toThrow(/timbrado/)
    // XML con entidades (ataque de expansión): se rechaza antes de leerlo
    expect(() => leerCfdi('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><cfdi:Comprobante/>')).toThrow(/DOCTYPE/)
  })
})
