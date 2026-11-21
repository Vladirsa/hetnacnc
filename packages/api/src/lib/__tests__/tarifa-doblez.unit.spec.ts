import { mediana, precioPorDoblez, precioPorPieza, tarifasDePerfiles } from "../tarifa-doblez"

describe("tarifas de referencia de los acabados", () => {
  it("lee precios por doblez y descarta otras unidades", () => {
    expect(precioPorDoblez("$15 por doblez")).toBe(15)
    expect(precioPorDoblez("desde 12 pesos")).toBe(12)
    expect(precioPorDoblez("$1,200 el lote")).toBeNull()
    expect(precioPorDoblez("$150 por pieza")).toBeNull()
    expect(precioPorDoblez("")).toBeNull()
  })
  it("lee precios por pieza y descarta m², hora y lote", () => {
    expect(precioPorPieza("desde $80 por pieza")).toBe(80)
    expect(precioPorPieza("$50 c/u")).toBe(50)
    expect(precioPorPieza("$300 el m²")).toBeNull()
    expect(precioPorPieza("$250 la hora")).toBeNull()
  })
  it("usa la mediana", () => {
    expect(mediana([10, 100, 15])).toBe(15)
    expect(mediana([])).toBeNull()
  })
  it("arma las tarifas con los perfiles de los talleres", () => {
    const t = tarifasDePerfiles([
      { acabados: [{ clave: "pintura_electrostatica", precio: "$120 por pieza" }, { clave: "doblez", precio: "$15 por doblez" }] },
      { acabados: [{ clave: "pintura_electrostatica", precio: "desde $100" }, { clave: "lijado", precio: "$400 la hora" }] },
      { acabados: [{ clave: "pintura_electrostatica", precio: "$140" }] },
    ])
    expect(t.find((x) => x.clave === "pintura_electrostatica")).toMatchObject({ tarifa: 120, talleres: 3, unidad: "pieza" })
    expect(t.find((x) => x.clave === "doblez")).toMatchObject({ tarifa: 15, unidad: "doblez" })
    expect(t.find((x) => x.clave === "lijado")).toBeUndefined()
  })
})
