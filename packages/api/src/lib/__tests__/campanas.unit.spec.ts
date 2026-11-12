import { caber, csvGoogle, sanear } from "../campanas"

describe("motor de campañas", () => {
  it("respeta los límites de cada plataforma sin cortar palabras", () => {
    expect(caber("Cotiza tu pieza CNC en minutos con talleres", 30).length).toBeLessThanOrEqual(30)
    expect(caber("Cotiza tu pieza CNC en minutos con talleres", 30)).not.toMatch(/\s$/)
    const p = sanear({
      nombre: "x", resumen: "r", publico: "p", titulos_imagen: ["a"],
      meta: { edad_min: 10, edad_max: 99, intereses: ["CNC", "CNC"], cta: "SIGN_UP", textos: [{ principal: "a".repeat(200), titulo: "b".repeat(60), descripcion: "c".repeat(50) }] },
      google: { ruta1: "cotiza ya!", ruta2: "", negativas: [], grupos: [{ nombre: "g", palabras: ["corte laser"], titulos: ["Un título que es demasiado largo para Google Ads"], descripciones: ["d"] }] },
      tiktok: { textos: ["t".repeat(150)], intereses: [], edad_min: 18, edad_max: 40, cta: "Más" },
    })
    expect(p.meta.edad_min).toBe(18)
    expect(p.meta.edad_max).toBe(65)
    expect(p.meta.intereses).toEqual(["CNC"])
    expect(p.meta.textos[0].principal.length).toBeLessThanOrEqual(125)
    expect(p.meta.textos[0].titulo.length).toBeLessThanOrEqual(40)
    expect(p.google.grupos[0].titulos[0].length).toBeLessThanOrEqual(30)
    expect(p.google.ruta1).toBe("cotizaya")
    expect(p.tiktok.textos[0].length).toBeLessThanOrEqual(100)
  })

  it("arma el CSV de Google Ads Editor en pausa con palabras y anuncio", () => {
    const c = { nombre: "Cotizador", que: "cotizador", diario: 150, zona: "Todo México", ligas: { google: "https://hetnacnc.com/r/abcdefg" }, plan: { google: { ruta1: "cotizador", ruta2: "cnc", negativas: ["empleo"], grupos: [{ nombre: "Cotizar DXF", palabras: ["cotizar corte laser"], titulos: ["Cotiza con tu DXF"], descripciones: ["Sube tu DXF y obtén el precio."] }] } } }
    const csv = csvGoogle(c)
    expect(csv.split("\n")[0]).toContain("Headline 15")
    expect(csv).toContain("Paused")
    expect(csv).toContain("cotizar corte laser")
    expect(csv).toContain("Campaign Negative Broad")
    expect(csv).toContain("https://hetnacnc.com/r/abcdefg")
  })
})
