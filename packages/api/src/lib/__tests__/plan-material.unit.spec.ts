import { limpiar, palabras, piezasDeTexto, textosDe } from "../fabrica/plan-material"
import { recortarPorDia } from "../estrategia"

describe("Material del plan", () => {
  it("limpia ligas y hashtags", () => {
    expect(limpiar("Hola {{liga}}\n#CNC #Mexico\nhttps://x.com/a fin")).toBe("Hola\nfin")
  })
  it("corta a n palabras", () => {
    expect(palabras("uno dos tres cuatro", 2)).toBe("uno dos…")
    expect(palabras("uno dos", 5)).toBe("uno dos")
  })
  it("saca gancho y frases del guion si lo hay", () => {
    const r = piezasDeTexto("¿Sabías cuánto cuesta cortar acero?\nCotiza gratis. {{liga}}", "Guion: Primer segundo: chispas del láser. Muestra la pieza terminada en la mano. Cierra con la liga del perfil.")
    expect(r.gancho).toBe("¿Sabías cuánto cuesta cortar acero?")
    expect(r.frases.length).toBeGreaterThanOrEqual(2)
    expect(r.frases.join(" ")).toContain("pieza terminada")
  })
  it("textos en inglés para EE.UU.", () => {
    expect(textosDe("talleres", "us").perfil).toBe("link in bio")
    expect(textosDe("talleres", "mx").cta).toBe("Recibe trabajos sin comisión")
  })
  it("recorta a 2 por red y día y gana México", () => {
    const d = new Date("2026-11-16T17:00:00Z")
    const filas = [
      { red: "instagram", mercado: "us", fecha: d },
      { red: "instagram", mercado: "mx", fecha: d },
      { red: "instagram", mercado: "co", fecha: d },
      { red: "instagram", mercado: "mx", fecha: new Date("2026-11-17T17:00:00Z") },
    ]
    const r = recortarPorDia(filas, { mx: 100, co: 35, us: 25 })
    expect(r).toHaveLength(3)
    expect(r.find((f) => f.mercado === "us")).toBeUndefined()
  })
})
