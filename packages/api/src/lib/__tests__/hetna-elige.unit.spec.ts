import { decidirEleccion } from "../hetna-elige"

const H = 3_600_000
const ahora = new Date("2026-11-23T18:00:00Z")
const hace = (h: number) => new Date(ahora.getTime() - h * H)
const prop = (id: string, precio: number, dias: number, creadaHace: number, puntualidad?: number) => ({
  id,
  precio,
  dias,
  creada: hace(creadaHace),
  taller: { calificacion: 4.5, resenas: 3, verificado: true, medido: puntualidad != null ? { puntualidad_pct: puntualidad, suficiente: true } : null },
})
const lejos = new Date(ahora.getTime() + 5 * 24 * H)

describe("HETNA elige", () => {
  it("con 3 propuestas elige ya", () => {
    const e = decidirEleccion([prop("a", 1000, 5, 1), prop("b", 900, 5, 1), prop("c", 1500, 3, 1)], { ahora, cierra_en: lejos })
    expect(e).not.toBeNull()
    expect(["a", "b", "c"]).toContain(e!.id)
  })
  it("con 2 espera 24 h desde la primera", () => {
    expect(decidirEleccion([prop("a", 1000, 5, 3), prop("b", 900, 5, 2)], { ahora, cierra_en: lejos })).toBeNull()
    expect(decidirEleccion([prop("a", 1000, 5, 25), prop("b", 900, 5, 2)], { ahora, cierra_en: lejos })).not.toBeNull()
  })
  it("con 1 sólo cerca del cierre", () => {
    expect(decidirEleccion([prop("a", 1000, 5, 30)], { ahora, cierra_en: lejos })).toBeNull()
    const e = decidirEleccion([prop("a", 1000, 5, 30)], { ahora, cierra_en: new Date(ahora.getTime() + 10 * H) })
    expect(e).toEqual({ id: "a", razones: ["Es la única propuesta dentro de tu presupuesto"], unica: true })
  })
  it("respeta el presupuesto máximo", () => {
    const e = decidirEleccion([prop("a", 1000, 5, 1), prop("b", 3000, 2, 1), prop("c", 2500, 2, 1)], { ahora, cierra_en: new Date(ahora.getTime() + 10 * H), tope: 1200 })
    expect(e!.id).toBe("a")
    expect(decidirEleccion([prop("b", 3000, 2, 30)], { ahora, cierra_en: new Date(ahora.getTime() + 10 * H), tope: 1200 })).toBeNull()
  })
})
