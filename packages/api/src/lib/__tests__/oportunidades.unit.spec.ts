import { agrupar, topDe } from "../fabrica/oportunidades"

describe("Oportunidades (plantillas de dos lados)", () => {
  const filas = [
    { estado: "Jalisco", servicio: "Corte láser" }, { estado: "Jalisco", servicio: "Corte láser" }, { estado: "Jalisco", servicio: "Torno" },
    { estado: "Puebla", servicio: "Router CNC" }, { estado: "", servicio: "Plasma" },
  ]
  it("agrupa por estado y proceso; las confidenciales no cuentan por estado", () => {
    const m = agrupar(filas)
    expect(m.total).toBe(5)
    expect(m.estados[0]).toMatchObject({ estado: "Jalisco", total: 3 })
    expect(m.estados.find((e) => e.estado === "")).toBeUndefined()
    expect(m.servicios["Plasma"]).toBe(1)
  })
  it("ordena los procesos de más a menos", () => {
    expect(topDe(agrupar(filas).estados[0].servicios)[0]).toEqual(["Corte láser", "2"])
  })
})
