import { horaCdmx, horasPublicada, tocaAvisoRapido } from "../respuesta-rapida"

const H = 3_600_000
// 2026-11-23 12:00 de CDMX = 18:00 UTC
const mediodia = new Date("2026-11-23T18:00:00Z")
const publicadaHace = (h: number, ahora = mediodia) => new Date(ahora.getTime() - h * H + 7 * 24 * H)

describe("respuesta rápida", () => {
  it("hora de CDMX", () => {
    expect(horaCdmx(mediodia)).toBe(12)
  })
  it("avisa a las 2 h sin propuesta, en horario", () => {
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(2.5) }, mediodia, 2)).toBe(true)
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(1) }, mediodia, 2)).toBe(false)
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(50) }, mediodia, 2)).toBe(false)
  })
  it("una sola vez y no después de otras rondas", () => {
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(3), aviso_rapido: new Date() }, mediodia, 2)).toBe(false)
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(3), difusion_ronda: 2 }, mediodia, 2)).toBe(false)
  })
  it("de noche espera a las 8 de la mañana", () => {
    const noche = new Date("2026-11-24T05:00:00Z") // 23:00 CDMX
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(3, noche) }, noche, 2)).toBe(false)
    const manana = new Date("2026-11-24T14:30:00Z") // 8:30 CDMX
    expect(tocaAvisoRapido({ cierra_en: publicadaHace(12.5, manana) }, manana, 2)).toBe(true)
  })
  it("horas publicada", () => {
    expect(horasPublicada(publicadaHace(3.04), mediodia)).toBe(3)
  })
})
