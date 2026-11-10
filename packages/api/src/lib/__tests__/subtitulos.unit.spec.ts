import { assKaraoke } from "../fabrica/video"
import { ganchoAlterno } from "../fabrica/plan-material"

describe("Subtítulos palabra por palabra y A/B", () => {
  it("arma un ASS con resaltado por palabra y tiempos", () => {
    const a = assKaraoke([{ texto: "Calcula tu hora máquina", inicio: 2.35, fin: 5.2 }])
    expect(a).toContain("PlayResY: 1920")
    expect(a).toContain("Dialogue: 0,0:00:02.35,0:00:05.20,Sub")
    expect((a.match(/\\kf\d+/g) || []).length).toBe(4)
  })
  it("quita llaves y diagonales que romperían el formato", () => {
    expect(assKaraoke([{ texto: "hola {mal} \\N", inicio: 0, fin: 1 }])).not.toContain("{mal}")
  })
  it("sin IA, el gancho B es la primera frase distinta", async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    expect(await ganchoAlterno("¿Cuánto cuesta?", ["¿Cuánto cuesta?", "Calcula tu hora máquina"], "mx")).toBe("Calcula tu hora máquina")
    if (prev) process.env.ANTHROPIC_API_KEY = prev
  })
})
