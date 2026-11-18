import { normalizarLectura } from "../muebles-ia"

describe("normalizarLectura (lo que regresa la IA para el constructor de muebles)", () => {
  it("acota medidas fuera de rango y redondea", () => {
    const l = normalizarLectura({ tipo: "exhibidor", ancho: 99999, fondoRepisas: 12.6, repisas: 40, altoGabinete: -5, barrote: 25.4, confianza: "alta", notas: "ok" })
    expect(l.ancho).toBe(2400)
    expect(l.fondoRepisas).toBe(100)
    expect(l.repisas).toBe(8)
    expect(l.altoGabinete).toBe(0)
    expect(l.barrote).toBe(25)
    expect(l.confianza).toBe("alta")
  })
  it("convierte valores raros en null y tipos desconocidos en 'otro'", () => {
    const l = normalizarLectura({ tipo: "silla" as never, ancho: "100" as never, separacion: NaN, divisores: "todos" as never, confianza: "segura" as never, notas: 5 as never })
    expect(l.tipo).toBe("otro")
    expect(l.ancho).toBeNull()
    expect(l.separacion).toBeNull()
    expect(l.divisores).toBeNull()
    expect(l.confianza).toBe("baja")
    expect(l.notas).toBe("")
  })
  it("respeta una lectura válida del plano de referencia", () => {
    const l = normalizarLectura({ tipo: "exhibidor", ancho: 1000, fondoGabinete: 492, fondoRepisas: 250, altoGabinete: 500, repisas: 3, espacioSobreGabinete: 211, separacion: 360, sobreUltima: 120, divisores: "ambos", numDivisores: 4, altoDivisor: 240, barrote: 25, confianza: "alta", notas: "Medidas del plano." })
    expect(l).toMatchObject({ tipo: "exhibidor", ancho: 1000, fondoGabinete: 492, divisores: "ambos", numDivisores: 4, barrote: 25 })
  })
  it("recorta notas muy largas", () => {
    expect(normalizarLectura({ notas: "x".repeat(2000) }).notas.length).toBe(600)
  })
})
