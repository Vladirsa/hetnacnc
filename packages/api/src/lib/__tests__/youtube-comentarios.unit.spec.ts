import { youtubeDe } from "../social-hub"
import { DATOS_HETNA } from "../social-comentarios"

describe("YouTube y comentarios", () => {
  it("la primera línea es el título con #Shorts y el resto la descripción", () => {
    const r = youtubeDe("Corte láser de acero en 30 segundos\n\nCotiza tu pieza: https://hetnacnc.com/r/x", "x", "https://v/a.mp4")
    expect(r.titulo).toBe("Corte láser de acero en 30 segundos #Shorts")
    expect(r.texto).toContain("Cotiza tu pieza")
    expect(r.red).toBe("youtube")
  })
  it("título largo se corta a 100 sin #Shorts", () => {
    expect(youtubeDe("a".repeat(120), "x", "v").titulo.length).toBe(100)
  })
  it("los datos para responder no traen precios inventados", () => {
    expect(DATOS_HETNA.join(" ")).not.toMatch(/\$\s?\d/)
  })
})
