import { agruparOrigenes, agruparRegistros, limpiarOrigen } from "../origen-visita"

describe("origen de la visita", () => {
  it("limpia lo que manda el navegador", () => {
    expect(limpiarOrigen({ fuente: "Meta", medio: "paid", campana: "solicitudes_<b>", contenido: "anuncio-a" })).toEqual({
      fuente: "meta",
      medio: "paid",
      campana: "solicitudes_b",
      contenido: "anuncio-a",
    })
    expect(limpiarOrigen({ medio: "x" })).toBeNull()
    expect(limpiarOrigen("meta")).toBeNull()
    expect(limpiarOrigen(null)).toBeNull()
  })
  it("agrupa los registros de taller", () => {
    const r = agruparRegistros([{ datos: { origen: { fuente: "meta", campana: "talleres" } } }, { datos: { origen: { fuente: "meta", campana: "talleres" } } }, { datos: {} }])
    expect(r).toEqual([
      { fuente: "meta", campana: "talleres", registros: 2 },
      { fuente: "directo", campana: "", registros: 1 },
    ])
  })
  it("agrupa por fuente y campaña", () => {
    const r = agruparOrigenes([
      { trabajo: { origen: { fuente: "meta", campana: "sol" } }, propuesta_elegida: "p1" },
      { trabajo: { origen: { fuente: "meta", campana: "sol" } } },
      { trabajo: {} },
    ])
    expect(r[0]).toEqual({ fuente: "meta", campana: "sol", solicitudes: 2, con_propuesta_elegida: 1 })
    expect(r[1]).toMatchObject({ fuente: "directo", solicitudes: 1 })
  })
})
