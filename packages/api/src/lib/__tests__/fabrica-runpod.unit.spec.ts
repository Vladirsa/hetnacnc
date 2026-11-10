import sharp from "sharp"

import { PROMPTS_TEMA, VOZ, correr, idiomaDe, runpodListo } from "../fabrica/runpod"
import { escenaLarga, TEMAS } from "../fabrica/render"

describe("Fábrica Fase B (RunPod)", () => {
  it("elige idioma y voz por mercado y género", () => {
    expect(idiomaDe("us")).toBe("en")
    expect(idiomaDe("br")).toBe("pt")
    expect(idiomaDe("mx")).toBe("es")
    expect(VOZ("es")).toBe("em_alex")
    expect(VOZ("es", "mujer")).toBe("ef_dora")
    expect(VOZ("en", "mujer")).toBe("af_heart")
  })
  it("cada tema tiene instrucciones para generar fondos sin texto", () => {
    for (const t of TEMAS) {
      expect(PROMPTS_TEMA[t]?.length).toBeGreaterThan(0)
      for (const p of PROMPTS_TEMA[t]) expect(p).toContain("no text")
    }
  })
  it("sin configurar RunPod avisa en vez de fallar raro", async () => {
    delete process.env.RUNPOD_FABRICA_ENDPOINT_ID
    expect(runpodListo()).toBe(false)
    await expect(correr({ tarea: "voz" })).rejects.toThrow(/RunPod/)
  })
  it("la escena del video largo sale en 16:9", async () => {
    const m = await sharp(await escenaLarga({ tema: "laser", capitulo: "Capítulo 1" })).metadata()
    expect([m.width, m.height]).toEqual([1920, 1080])
  })
})
