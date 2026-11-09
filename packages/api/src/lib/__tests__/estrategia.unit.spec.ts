import { GUIAS, PUBLICOS, REDES_MERCADO, instanteEn, lunesDe, puntuar } from "../estrategia"
import { MERCADOS, REDES, dentroDeHorario, horaEn } from "../social-hub"

describe("Estrategia: guías, mercados y puntaje", () => {
  it("cada red del plan tiene guía y existe en el Social Hub", () => {
    for (const redes of Object.values(REDES_MERCADO)) for (const r of redes) {
      expect(GUIAS[r]).toBeDefined()
      expect((REDES as any)[r]).toBeDefined()
    }
    for (const g of Object.values(GUIAS)) for (const p of g.publicos) expect(PUBLICOS.some((x) => x.clave === p)).toBe(true)
  })

  it("convierte hora local de cada mercado a UTC", () => {
    const d = instanteEn("2026-11-16", 18, MERCADOS.us.zona)
    expect(horaEn(d, MERCADOS.us.zona)).toBe(18)
    const m = instanteEn("2026-11-16", 9, MERCADOS.mx.zona)
    expect(horaEn(m, MERCADOS.mx.zona)).toBe(9)
    expect(horaEn(instanteEn("2026-11-16", 10, MERCADOS.ar.zona), MERCADOS.ar.zona)).toBe(10)
  })

  it("el horario se respeta en la zona de cada mercado", () => {
    // 3:00 a.m. en Chicago -> se recorre a las 9
    const madrugada = instanteEn("2026-11-16", 3, MERCADOS.us.zona)
    expect(horaEn(dentroDeHorario(madrugada, { desde: 9, hasta: 20 }, MERCADOS.us.zona), MERCADOS.us.zona)).toBe(9)
  })

  it("lunesDe devuelve el lunes de la semana", () => {
    expect(lunesDe(new Date("2026-11-12T18:00:00Z"))).toBe("2026-11-09")
    expect(lunesDe(new Date("2026-11-15T18:00:00Z"))).toBe("2026-11-09")
  })

  it("puntaje: Instagram sin liga en el texto, con llamada a compartir y hashtags", () => {
    const malo = puntuar("Visita https://hetnacnc.com", "instagram")
    const bueno = puntuar("Así corta un láser 6 mm de acero 🔥\nMándaselo a tu socio del taller. Liga en el perfil.\n#CNC #CorteLaser #Mexico", "instagram", { medios: [{ url: "https://x/v.mp4", tipo: "video" }] })
    expect(bueno.puntaje).toBeGreaterThan(malo.puntaje)
    expect(malo.revisiones.find((r) => r.texto.includes("Sin liga"))?.ok).toBe(false)
  })

  it("puntaje: LinkedIn castiga la liga en el texto", () => {
    const r = puntuar("Nuevo índice de precios CNC. Comenta qué opinas. {{liga}}", "linkedin")
    expect(r.revisiones.find((x) => x.texto.includes("primer comentario"))?.ok).toBe(false)
  })
})
