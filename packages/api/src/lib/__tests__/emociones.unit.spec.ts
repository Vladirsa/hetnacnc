import { EMOCIONES, REGLAS_EMOCION, emocionesDe } from "../estrategia"

describe("Mapa emocional", () => {
  it("tiene las seis emociones del dueño", () => {
    expect(EMOCIONES.map((e) => e.clave)).toEqual(["deseo", "belleza", "tranquilidad", "suenos", "seguridad", "esperanza"])
  })
  it("cada público tiene al menos una emoción", () => {
    for (const p of ["talleres", "proveedores", "clientes_empresa", "clientes_particulares"]) expect(emocionesDe(p).length).toBeGreaterThan(0)
  })
  it("Comunidad no lleva emoción de venta", () => {
    expect(emocionesDe("comunidad")).toEqual([])
  })
  it("las reglas prohíben prometer riqueza y dirigirse a menores", () => {
    expect(REGLAS_EMOCION).toMatch(/riqueza/)
    expect(REGLAS_EMOCION).toMatch(/menores/)
  })
})
