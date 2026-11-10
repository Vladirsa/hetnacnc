import { puntajeDe, vistaPrevia } from "../social-telegram"

describe("Aprobación por Telegram", () => {
  const p = {
    id: "spost_1", titulo: "Instagram · Cómo cotizar", redes: ["instagram"], mercado: "mx", programada_para: "2026-11-11T18:00:00Z",
    textos: { instagram: "¿Necesitas una pieza CNC?\nCotiza gratis, liga en la bio. Mándaselo a quien lo necesite.\n#CNC #CorteLaser #Mexico\n{{liga}}" },
    medios: [{ url: "https://x/a.mp4", tipo: "video" }],
  }
  it("la vista previa cabe en el pie de foto y no muestra la marca de liga", () => {
    const v = vistaPrevia(p)
    expect(v.length).toBeLessThanOrEqual(950)
    expect(v).toContain("🎬 video")
    expect(v).not.toContain("{{liga}}")
    expect(v).toContain("Instagram")
  })
  it("el puntaje es el menor de sus redes", () => {
    expect(puntajeDe(p)).toBeGreaterThan(0)
    expect(puntajeDe({ ...p, redes: [] })).toBe(0)
  })
})
