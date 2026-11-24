import { esCancelacion, esConfirmacion, fechaHabil, parsearCotizacion } from "../propuesta-whatsapp"

describe("propuesta por WhatsApp", () => {
  it("lee precio y días", () => {
    expect(parsearCotizacion("1500, 3 días")).toEqual({ precio: 1500, dias: 3, folio: null })
    expect(parsearCotizacion("$1,500 en 3 dias")).toEqual({ precio: 1500, dias: 3, folio: null })
    expect(parsearCotizacion("HET-00123 900 2 días")).toEqual({ precio: 900, dias: 2, folio: 123 })
    expect(parsearCotizacion("Precio 2500 pesos con IVA, entrega 5 días hábiles")).toEqual({ precio: 2500, dias: 5, folio: null })
    expect(parsearCotizacion("3 dias 1200")).toEqual({ precio: 1200, dias: 3, folio: null })
  })
  it("no confunde preguntas ni charla con una propuesta", () => {
    expect(parsearCotizacion("cuánto cuesta el plan de 300 por 30 días?")).toBeNull()
    expect(parsearCotizacion("hola, tengo 2 máquinas, 3 días libres")).toBeNull()
    expect(parsearCotizacion("1500")).toBeNull()
    expect(parsearCotizacion("5 días")).toBeNull()
    expect(parsearCotizacion("1500, 900 días")).toBeNull()
  })
  it("confirmación y cancelación", () => {
    expect(esConfirmacion("Sí")).toBe(true)
    expect(esConfirmacion("si!")).toBe(true)
    expect(esConfirmacion("si pero mañana")).toBe(false)
    expect(esCancelacion("no")).toBe(true)
  })
  it("fecha con días hábiles", () => {
    // viernes 2026-11-20 + 1 día hábil = lunes 23
    expect(fechaHabil(1, new Date("2026-11-20T12:00:00"))).toBe("2026-11-23")
  })
})
