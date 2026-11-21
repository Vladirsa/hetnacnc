import { calidadTaller, recomendarPropuesta } from "../asignacion"

const taller = (o: any = {}) => ({ calificacion: null, resenas: 0, verificado: false, medido: null, ...o })

describe("asignación del mejor taller", () => {
  it("no recomienda con menos de 2 propuestas", () => {
    expect(recomendarPropuesta([{ id: "a", precio: 100, dias: 3, taller: taller() }])).toBeNull()
  })
  it("prefiere al que cumple aunque cueste un poco más", () => {
    const r = recomendarPropuesta([
      { id: "barato", precio: 1000, dias: 5, taller: taller({ medido: { suficiente: true, puntaje: 40, terminados: 6 } }) },
      { id: "cumplido", precio: 1080, dias: 5, taller: taller({ calificacion: 4.9, resenas: 12, verificado: true, medido: { suficiente: true, puntaje: 95, terminados: 20 } }) },
    ])
    expect(r?.id).toBe("cumplido")
    expect(r?.razones.join(" ")).toMatch(/Cumplimiento 95/)
  })
  it("con talleres sin historial gana el más barato y rápido", () => {
    const r = recomendarPropuesta([
      { id: "a", precio: 1500, dias: 10, taller: taller() },
      { id: "b", precio: 1000, dias: 4, taller: taller() },
    ])
    expect(r?.id).toBe("b")
    expect(r?.razones[0]).toMatch(/mejor precio/)
  })
  it("ignora la moneda minoritaria", () => {
    const r = recomendarPropuesta([
      { id: "usd", precio: 10, dias: 2, moneda: "USD", taller: taller() },
      { id: "m1", precio: 900, dias: 5, moneda: "MXN", taller: taller() },
      { id: "m2", precio: 1000, dias: 5, moneda: "MXN", taller: taller() },
    ])
    expect(r?.id).toBe("m1")
  })
  it("la calidad del taller sale de lo medido", () => {
    expect(calidadTaller({})).toBe(0)
    expect(calidadTaller({ calificacion: 5, resenas: 4, medido: { suficiente: true, puntaje: 100, respuesta_horas: 1 } })).toBe(6)
  })
})
