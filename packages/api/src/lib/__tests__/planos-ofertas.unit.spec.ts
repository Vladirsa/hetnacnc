jest.mock("@mercurjs/core/workflows", () => ({}))
jest.mock("../envios-automaticos", () => ({}))
jest.mock("../publicar-diseno", () => ({}))
jest.mock("../publicar-rapido", () => ({}))
import { ErrorOferta, validarOfertaPlano } from "../planos-ofertas"

const base = { product_id: "prod_1", dias: 5, envio_gratis: true, variantes: [{ variant_id: "v1", precio: 1450 }, { variant_id: "v2", precio: "" }] }

describe("validarOfertaPlano", () => {
  it("acepta precio, días y envío; un precio vacío quita el acabado", () => {
    const d = validarOfertaPlano(base)
    expect(d.dias).toBe(5)
    expect(d.envio_gratis).toBe(true)
    expect(d.variantes).toEqual([{ variant_id: "v1", precio: 1450 }, { variant_id: "v2", precio: null }])
  })
  it("rechaza días y precios fuera de rango", () => {
    expect(() => validarOfertaPlano({ ...base, dias: 0 })).toThrow(ErrorOferta)
    expect(() => validarOfertaPlano({ ...base, dias: 90 })).toThrow(ErrorOferta)
    expect(() => validarOfertaPlano({ ...base, variantes: [{ variant_id: "v1", precio: 10 }] })).toThrow(ErrorOferta)
  })
  it("el envío gratis sólo si viene en true", () => {
    expect(validarOfertaPlano({ ...base, envio_gratis: "true" }).envio_gratis).toBe(false)
  })
})
