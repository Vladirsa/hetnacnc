import { ErrorLicencia, leerLicencia, validarLicencia } from "../licencias"

describe("licencias de diseños", () => {
  it("sin licencia o con una desconocida, personal", () => {
    expect(leerLicencia(null)).toEqual({ licencia: "personal", piezas: null })
    expect(leerLicencia({ licencia: "pirata" })).toEqual({ licencia: "personal", piezas: null })
  })
  it("comercial limitada trae piezas (100 si no tiene)", () => {
    expect(leerLicencia({ licencia: "comercial_limitada" })).toEqual({ licencia: "comercial_limitada", piezas: 100 })
    expect(leerLicencia({ licencia: "comercial_limitada", licencia_piezas: 250 })).toEqual({ licencia: "comercial_limitada", piezas: 250 })
    expect(leerLicencia({ licencia: "comercial_ampliada", licencia_piezas: 5 })).toEqual({ licencia: "comercial_ampliada", piezas: null })
  })
  it("valida lo que manda el vendedor", () => {
    expect(validarLicencia("personal", 50)).toEqual({ licencia: "personal", licencia_piezas: "" })
    expect(validarLicencia("comercial_limitada", "30")).toEqual({ licencia: "comercial_limitada", licencia_piezas: 30 })
    expect(() => validarLicencia("comercial_limitada", 0)).toThrow(ErrorLicencia)
    expect(() => validarLicencia("gratis")).toThrow(ErrorLicencia)
  })
})
