import { CIERRES, FRASE_FINAL, capasDe, conEnfasis, htmlSub, paginaEscena, tiempos, validarGuion } from "../fabrica/explicativo"
import { DIBUJOS, IDS_DIBUJO } from "../fabrica/explicativo-dibujos"

const escena = (o: any = {}) => ({ tipo: "lista", kicker: "Error 1", titulo: "Contornos que", titulo_naranja: "no cierran", dibujo: "archivo", etiqueta: "", puntos: ["Uno", "Dos", "Tres"], mal: "", bien: "", frases: ["El láser necesita *figuras cerradas* siempre."], ...o })

describe("validarGuion", () => {
  it("la primera escena es portada y siempre agrega el cierre con una oferta real", () => {
    const g = validarGuion({ tema: "t", serie: "archivos", cierre: 2, escenas: [escena({ tipo: "lista" }), escena()] })
    expect(g.escenas[0].tipo).toBe("portada")
    const c = g.escenas[g.escenas.length - 1]
    expect(c.tipo).toBe("cierre")
    expect(c.puntos[0]).toBe(CIERRES[2].titulo)
    expect(c.frases).toEqual([CIERRES[2].voz, FRASE_FINAL])
    expect(g.serie).toBe("ARCHIVOS")
  })
  it("cierre fuera de rango usa el primero", () => {
    expect(validarGuion({ cierre: 9, escenas: [escena()] }).cierre).toBe(0)
  })
  it("acota textos, descarta dibujos que no existen y comparación incompleta", () => {
    const g = validarGuion({
      escenas: [
        escena({ tipo: "portada", dibujo: "inventado" }),
        escena({ tipo: "dibujo", dibujo: "no-existe" }),
        escena({ tipo: "comparacion", mal: "", bien: "algo" }),
        escena({ titulo: "Un título larguísimo que no cabe", puntos: ["a".repeat(80), "b", "c", "d"] }),
      ],
    })
    expect(g.escenas[0].dibujo).toBe("engrane")
    expect(g.escenas[1].tipo).toBe("lista")
    expect(g.escenas[2].tipo).toBe("lista")
    expect(g.escenas[3].titulo.length).toBeLessThanOrEqual(16)
    expect(g.escenas[3].puntos).toHaveLength(3)
    expect(g.escenas[3].puntos[0].length).toBeLessThanOrEqual(30)
  })
  it("descarta escenas sin voz o sin contenido y cuenta palabras sin asteriscos", () => {
    const g = validarGuion({ escenas: [escena(), escena({ frases: [] }), escena({ puntos: [] })] })
    expect(g.escenas.map((e: any) => e.tipo)).toEqual(["portada", "cierre"])
    expect(g.palabras).toBeGreaterThan(5)
  })
  it("guion vacío no truena", () => {
    expect(validarGuion(null).escenas).toHaveLength(1)
  })
})

describe("plantillas", () => {
  it("escapa el texto de la IA y sólo deja el resaltado", () => {
    expect(conEnfasis("<script>x</script> *ojo*")).toBe("&lt;script&gt;x&lt;/script&gt; <em>ojo</em>")
    expect(htmlSub("hola *mundo*")).toContain("<em>mundo</em>")
    const c = capasDe(escena({ puntos: ['<img src=x onerror="a">', "b", "c"] }), "")
    expect(c.map((x) => x[1]).join("")).not.toContain("<img src=x")
  })
  it("cada tipo de escena tiene sus capas con tiempos crecientes", () => {
    for (const tipo of ["portada", "lista", "dibujo", "comparacion", "checklist", "cierre"]) {
      const c = capasDe(escena({ tipo, etiqueta: "RECHAZADO", mal: "a", bien: "b", puntos: tipo === "dibujo" ? ["x", "y"] : tipo === "cierre" ? ["Cotiza", "sub"] : ["a", "b", "c"] }), "")
      expect(c.length).toBeGreaterThan(0)
      const t = c.map((x) => x[0])
      expect([...t].sort((a, b) => a - b)).toEqual(t)
    }
  })
  it("la página alta trae base + capas + un subtítulo por frase", () => {
    const p = paginaEscena(escena({ frases: ["uno dos", "tres cuatro"] }), 0, 8, "SERIE", { fuentes: "/f", logo: "data:," })
    expect(p.hojas).toBe(1 + 3 + 2)
    expect(p.tiempos).toHaveLength(3)
    expect(p.html).toContain("01 / 08")
  })
  it("todos los dibujos son SVG del mismo tamaño", () => {
    expect(IDS_DIBUJO.length).toBeGreaterThanOrEqual(12)
    for (const k of IDS_DIBUJO) expect(DIBUJOS[k].svg).toMatch(/^<svg width="952" height="440"/)
  })
})

describe("tiempos", () => {
  it("cada frase entra cuando termina la anterior", () => {
    const r = tiempos([escena({ frases: ["a b", "c d"] })], [[2, 3]], 0)
    expect(r[0].inicios).toEqual([0, 2.22])
    expect(r[0].habla).toBeCloseTo(5.22)
  })
  it("una sola voz para dos frases: reparte por largo", () => {
    const r = tiempos([escena({ frases: ["aaaa", "aaaa"] })], [[4]], 0)
    expect(r[0].inicios).toEqual([0, 2])
  })
  it("si no llega al mínimo alarga las pausas (sin pasar de 1.6 s por escena)", () => {
    const es = [escena(), escena(), escena()]
    const r = tiempos(es, [[10], [10], [10]], 40)
    const total = r.reduce((a, x) => a + x.dur, 0)
    expect(total).toBeGreaterThanOrEqual(34.9)
    expect(r[0].dur - (10 + 0.45)).toBeLessThanOrEqual(1.61)
  })
})
