import { mediana, precioPorDoblez } from "../tarifa-doblez"

describe("tarifa de doblez de referencia", () => {
  it("lee precios por doblez y descarta otras unidades", () => {
    expect(precioPorDoblez("$15 por doblez")).toBe(15)
    expect(precioPorDoblez("desde 12 pesos")).toBe(12)
    expect(precioPorDoblez("$1,200 el lote")).toBeNull()
    expect(precioPorDoblez("$150 por pieza")).toBeNull()
    expect(precioPorDoblez("")).toBeNull()
  })
  it("usa la mediana", () => {
    expect(mediana([10, 100, 15])).toBe(15)
    expect(mediana([])).toBeNull()
  })
})
