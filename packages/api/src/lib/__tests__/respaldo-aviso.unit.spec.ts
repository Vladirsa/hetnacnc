import { estadoRespaldo } from "../centro-control"

describe("Aviso de respaldo atrasado", () => {
  const antes = process.env.NODE_ENV
  afterAll(() => { process.env.NODE_ENV = antes })
  const ahora = Date.UTC(2026, 10, 18, 12)
  const hace = (h: number) => () => `${Math.floor(ahora / 1000 - h * 3600)} 2026-11-18 03:00:00`

  it("no avisa fuera de producción", () => {
    process.env.NODE_ENV = "development"
    expect(estadoRespaldo(ahora, () => { throw new Error("no existe") })).toBeNull()
  })

  it("en producción: al día no avisa; atrasado o sin marca, sí", () => {
    process.env.NODE_ENV = "production"
    expect(estadoRespaldo(ahora, hace(10))).toBeNull()
    expect(estadoRespaldo(ahora, hace(30))?.titulo).toMatch(/30 horas/)
    expect(estadoRespaldo(ahora, () => { throw new Error("no existe") })?.nivel).toBe("rojo")
    expect(estadoRespaldo(ahora, () => "basura")?.titulo).toMatch(/No hay registro/)
  })
})
