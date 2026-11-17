import { cuerpoGlobal, cuerpoNominativo, desglose, validarReceptor, type Cobro } from "../cotizador-facturacion"

const cobro: Cobro = { proveedor: "stripe", cobroId: "st:in_123", negocioId: "n1", plan: "pro", monto: 599, moneda: "MXN", fecha: "2026-11-05T10:00:00Z" }

describe("CFDI de suscripciones del Cotizador", () => {
  it("desglosa el IVA de un precio con IVA incluido", () => {
    expect(desglose(599)).toEqual({ subtotal: 516.38, iva: 82.62, total: 599 })
    expect(desglose(299)).toEqual({ subtotal: 257.76, iva: 41.24, total: 299 })
    expect(desglose(1199)).toEqual({ subtotal: 1033.62, iva: 165.38, total: 1199 })
  })

  it("receptor válido sólo con RFC, razón social, régimen y CP completos", () => {
    const ok = validarReceptor({ razon_social: "TALLER RUIZ", rfc: "ruiz800101ab1", regimen: "612", cp: "90000", correo: "t@x.mx" })
    expect(ok?.rfc).toBe("RUIZ800101AB1")
    expect(validarReceptor({ razon_social: "", rfc: "RUIZ800101AB1", regimen: "612", cp: "90000" })).toBeNull()
    expect(validarReceptor({ razon_social: "X", rfc: "MAL", regimen: "612", cp: "90000" })).toBeNull()
    expect(validarReceptor({ razon_social: "X", rfc: "XAXX010101000", regimen: "616", cp: "90000" })).toBeNull()
    expect(validarReceptor({ razon_social: "X", rfc: "RUIZ800101AB1", regimen: "612", cp: "900" })).toBeNull()
  })

  it("CFDI nominativo: total = lo cobrado, IVA incluido, uso G03, PUE", () => {
    const rec = validarReceptor({ razon_social: "TALLER RUIZ", rfc: "RUIZ800101AB1", regimen: "626", cp: "90000", correo: "t@x.mx" })!
    const c = cuerpoNominativo(cobro, rec)
    expect(c.customer).toEqual({ legal_name: "TALLER RUIZ", tax_id: "RUIZ800101AB1", tax_system: "626", address: { zip: "90000" }, email: "t@x.mx" })
    expect(c.items[0].product).toMatchObject({ price: 599, tax_included: true, taxes: [{ type: "IVA", rate: 0.16 }], product_key: "81112106" })
    expect(c.items[0].product.description).toContain("Plan Pro")
    expect(c).toMatchObject({ use: "G03", payment_method: "PUE", currency: "MXN" })
  })

  it("en dólares se emite en USD", () => {
    const rec = validarReceptor({ razon_social: "SHOP LLC", rfc: "RUIZ800101AB1", regimen: "612", cp: "90000" })!
    expect(cuerpoNominativo({ ...cobro, proveedor: "paypal", cobroId: "pp:ABC", monto: 59, moneda: "USD" }, rec).currency).toBe("USD")
  })

  it("factura global: público en general, periodicidad mensual, un concepto por cobro", () => {
    const g = cuerpoGlobal([cobro, { ...cobro, cobroId: "mp:9", proveedor: "mercadopago", plan: "taller", monto: 299 }], 2026, 11, "90000")
    expect(g.customer).toEqual({ legal_name: "PUBLICO EN GENERAL", tax_id: "XAXX010101000", tax_system: "616", address: { zip: "90000" } })
    expect(g.global).toEqual({ periodicity: "month", months: "11", year: 2026 })
    expect(g.items.map((i) => i.product.price)).toEqual([599, 299])
    expect(g.use).toBe("S01")
  })
})
