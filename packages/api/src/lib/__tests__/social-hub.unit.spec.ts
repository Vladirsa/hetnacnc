import { REDES, adaptarSinIa, dentroDeHorario, textoBase } from "../social-hub"

describe("Social Hub (Fase 5A)", () => {
  it("el texto base siempre lleva la marca de la liga", () => {
    for (const o of ["licitacion", "taller", "producto", "foro", "manual"] as const) expect(textoBase(o, { titulo: "X" })).toContain("{{liga}}")
  })
  it("adapta sin IA: Instagram con hashtags y sin liga clicable, respeta el máximo", () => {
    const ig = adaptarSinIa("Hola {{liga}}", "instagram")
    expect(ig).toContain("#CNC")
    expect(ig).not.toContain("{{liga}}")
    expect(adaptarSinIa("a ".repeat(2000), "telegram").length).toBeLessThanOrEqual(REDES.telegram.max)
  })
  it("recorre al horario permitido (hora del centro de México)", () => {
    const h = { desde: 9, hasta: 20 }
    const hora = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "numeric", hourCycle: "h23" }).format(d))
    // 3:00 a.m. en México (09:00 UTC) -> se mueve a las 9
    const madrugada = new Date("2026-11-10T09:00:00Z")
    expect(hora(dentroDeHorario(madrugada, h))).toBe(9)
    // 12:00 en México (18:00 UTC) se queda igual
    const mediodia = new Date("2026-11-10T18:00:00Z")
    expect(dentroDeHorario(mediodia, h).getTime()).toBe(mediodia.getTime())
  })
})
