import sharp from "sharp"

import { temaDe } from "../fabrica"
import { cuadroVideo, lamina, miniatura, tarjeta } from "../fabrica/render"
import { corto, ffmpegDisponible, segundosPara } from "../fabrica/video"

jest.setTimeout(120_000)

describe("Fábrica de contenido (Fase A)", () => {
  it("elige el fondo según el tema del texto", () => {
    expect(temaDe("Corte láser de acero")).toBe("laser")
    expect(temaDe("Router CNC en MDF")).toBe("router")
    expect(temaDe("Plasma 6 mm")).toBe("plasma")
    expect(temaDe("Torno CNC de precisión")).toBe("torno")
    expect(temaDe("algo general")).toBe("taller")
  })

  it("produce tarjeta 4:5, lámina 4:5, cuadro 9:16 y miniatura 16:9", async () => {
    const med = async (b: Buffer) => { const m = await sharp(b).metadata(); return [m.width, m.height] }
    expect(await med(await tarjeta({ titulo: "Corte láser de acero 6 mm", cinta: { texto: "Se busca taller" }, cta: "Envía tu propuesta", liga: "https://hetnacnc.com/r/abc1234", datos: [["Lugar", "Puebla"]] }))).toEqual([1080, 1350])
    expect(await med(await lamina({ num: 2, total: 6, titulo: "Error 1", texto: "Explicación" }))).toEqual([1080, 1350])
    expect(await med(await cuadroVideo({ tipo: "gancho", texto: "Así corta un láser" }))).toEqual([1080, 1920])
    expect(await med(await miniatura({ titulo: "Cómo cotizar" }))).toEqual([1920, 1080])
  })

  it("arma un corto vertical con FFmpeg", async () => {
    if (!ffmpegDisponible()) return
    const png = await cuadroVideo({ tipo: "frase", texto: "Una sola pasada" })
    const v = await corto([{ png, segundos: 1 }, { png, segundos: 1 }])
    expect(v.buf.length).toBeGreaterThan(10_000)
    expect(segundosPara("una dos tres")).toBeGreaterThanOrEqual(2.2)
  })
})
