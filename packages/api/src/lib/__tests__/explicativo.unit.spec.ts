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

describe("fotos", () => {
  it("escena foto sin descripción ni producto se vuelve lista; máximo 3 fotos", () => {
    const f = (o: any = {}) => escena({ tipo: "foto", foto: "a laser cutting", producto: "", ...o })
    const g = validarGuion({ escenas: [escena(), f({ foto: "", puntos: ["a", "b"] }), f(), f(), f(), f({ puntos: [] })] })
    const tipos = g.escenas.map((e: any) => e.tipo)
    expect(tipos[1]).toBe("lista")
    expect(tipos.filter((t: string) => t === "foto")).toHaveLength(3)
  })
  it("la capa de foto usa el archivo local y marca la imagen ilustrativa", () => {
    const c = capasDe(escena({ tipo: "foto", foto_archivo: "/tmp/a b.jpg", foto_pie: "Corte <láser>", foto_ia: true }), "")
    const html = c.map((x) => x[1]).join("")
    expect(html).toContain("file:///tmp/a%20b.jpg")
    expect(html).toContain("IMAGEN ILUSTRATIVA")
    expect(html).toContain("Corte &lt;láser&gt;")
    expect(capasDe(escena({ tipo: "foto" }), "")).toEqual([])
  })
})

describe("versión larga (YouTube horizontal)", () => {
  const { numerarCapitulos, capitulosYoutube, paginaEscena: pagina, FRASE_FINAL_LARGO } = require("../fabrica/explicativo")
  it("valida con capítulos, más escenas y cierre de suscripción", () => {
    const muchas = Array.from({ length: 30 }, (_, i) => escena({ capitulo: `Cap ${Math.floor(i / 6) + 1}` }))
    const g = validarGuion({ escenas: muchas }, { largo: true })
    expect(g.formato).toBe("largo")
    expect(g.escenas.length).toBe(31)
    expect(g.escenas[3].capitulo).toBe("Cap 1")
    expect(g.escenas[g.escenas.length - 1].frases[1]).toBe(FRASE_FINAL_LARGO)
    expect(validarGuion({ escenas: muchas }).escenas.length).toBe(10) // el corto sigue con máximo 9 + cierre
  })
  it("numera los capítulos cuando cambia el nombre", () => {
    expect(numerarCapitulos([{ capitulo: "A" }, { capitulo: "A" }, { capitulo: "B" }, { capitulo: "" }]))
      .toEqual([{ n: 1, nombre: "A" }, { n: 1, nombre: "A" }, { n: 2, nombre: "B" }, undefined])
  })
  it("capítulos de YouTube: 0:00, al menos 3 y de 10 s o más", () => {
    const e = [{ nombre: "Intro", inicio: 0 }, { nombre: "Causas", inicio: 25 }, { nombre: "Causas", inicio: 40 }, { nombre: "Corto", inicio: 70 }, { nombre: "Checklist", inicio: 75 }]
    expect(capitulosYoutube(e, 200)).toEqual(["0:00 Intro", "0:25 Causas", "1:10 Corto"])
    expect(capitulosYoutube([{ nombre: "A", inicio: 0 }, { nombre: "B", inicio: 3 }, { nombre: "C", inicio: 17 }, { nombre: "D", inicio: 40 }], 60)).toEqual(["0:00 A", "0:17 C", "0:40 D"])
    expect(capitulosYoutube(e.slice(0, 2), 60)).toEqual([])
  })
  it("la página horizontal mide 1920×1080 y escala las capas dentro de la tarjeta", () => {
    const p = pagina(escena({ capitulo: "Causas" }), 2, 25, "SERIE", { fuentes: "/f", logo: "data:,", largo: true, capitulo: { n: 2, nombre: "Causas" } })
    expect(p.html).toContain("width:1920px")
    expect(p.html).toContain("CAPÍTULO 2")
    expect(p.html).toMatch(/transform:translate\([\d.]+px,-?[\d.]+px\) scale\(0\.\d+\)/)
  })
})

describe("YouTube: video largo sin #Shorts", () => {
  const { youtubeDe } = require("../social-hub")
  it("el vertical lleva #Shorts y el horizontal no", () => {
    expect(youtubeDe("Mi título\ndesc", "", "v.mp4").titulo).toBe("Mi título #Shorts")
    expect(youtubeDe("Mi título\ndesc", "", "v.mp4", { largo: true }).titulo).toBe("Mi título")
  })
})
