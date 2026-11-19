import { ErrorArticulo, MIN_LETRAS, leerArticuloTaller, textoAHtmlSeguro } from "../blog-instructores"
import { comisionPara, diasVigencia, escalones, siguienteEscalon } from "../comision-autores"

const largo = (extra = "") => extra + "\n\n" + "Texto de prueba sobre fresado de aluminio. ".repeat(Math.ceil(MIN_LETRAS / 40))

describe("artículos de instructores: HTML seguro", () => {
  it("escapa cualquier HTML que escriba el taller", () => {
    const h = textoAHtmlSeguro('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n"><svg onload=alert(1)>')
    expect(h).not.toMatch(/<(script|img|svg)/i) // sólo texto escapado, ninguna etiqueta real
    expect(h).toContain("&lt;script&gt;")
  })

  it("sólo hace ligas http(s), con nofollow ugc", () => {
    const h = textoAHtmlSeguro("[mi sitio](https://ejemplo.com/a) y [malo](javascript:alert(1)) y [dato](data:text/html,x)")
    expect(h).toContain('<a href="https://ejemplo.com/a" rel="nofollow ugc noopener" target="_blank">mi sitio</a>')
    expect(h).not.toMatch(/href="(javascript|data):/i)
  })

  it("no se puede romper el atributo href con comillas", () => {
    const h = textoAHtmlSeguro('[x](https://e.com/"onmouseover="alert(1))')
    expect(h).not.toMatch(/"onmouseover="/)
  })

  it("imágenes sólo https; títulos, listas y negritas", () => {
    expect(textoAHtmlSeguro("![foto](http://e.com/a.jpg)")).not.toContain("<img")
    expect(textoAHtmlSeguro("![foto](https://e.com/a.jpg)")).not.toContain("<img") // dominio ajeno: serviría para rastrear lectores
    expect(textoAHtmlSeguro("![foto](https://hetnacnc.com/static/a.jpg)")).toContain('<img src="https://hetnacnc.com/static/a.jpg" alt="foto" loading="lazy" />')
    expect(textoAHtmlSeguro("## Hola **mundo**")).toBe("<h2>Hola <strong>mundo</strong></h2>")
    expect(textoAHtmlSeguro("- uno\n- dos")).toBe("<ul><li>uno</li><li>dos</li></ul>")
  })

  it("valida largo, título y portada", () => {
    expect(() => leerArticuloTaller({ titulo: "Corto", texto: largo() })).toThrow(ErrorArticulo)
    expect(() => leerArticuloTaller({ titulo: "Un título suficiente", texto: "poco" })).toThrow(/corto/)
    expect(() => leerArticuloTaller({ titulo: "Un título suficiente", texto: largo(), portada_url: "https://otro-sitio.com/a.jpg" })).toThrow(/portada/)
    const a = leerArticuloTaller({ titulo: "Cómo fresar aluminio sin romper fresas", texto: largo("## Intro"), categoria: "router-cnc" })
    expect(a.categoria).toBe("router-cnc")
    expect(a.content_html.startsWith("<h2>Intro</h2>")).toBe(true)
    expect(a.excerpt.length).toBeLessThanOrEqual(220)
  })
})

describe("comisión de instructores con artículos", () => {
  it("escalones por omisión: 1 artículo 4.5 %, 2 o más 4 %", () => {
    expect(escalones("")).toEqual([{ articulos: 1, pct: 4.5 }, { articulos: 2, pct: 4 }])
    expect(comisionPara(0, 5)).toBe(5)
    expect(comisionPara(1, 5)).toBe(4.5)
    expect(comisionPara(7, 5)).toBe(4)
  })
  it("nunca sube la comisión normal", () => {
    expect(comisionPara(1, 4.2)).toBe(4.2)
    expect(comisionPara(2, 4.2)).toBe(4)
  })
  it("lee la regla del entorno e ignora valores raros", () => {
    expect(escalones("3:2, 1:4.5, x:1, 2:0")).toEqual([{ articulos: 1, pct: 4.5 }, { articulos: 3, pct: 2 }])
    expect(diasVigencia("2")).toBe(90)
    expect(diasVigencia("60")).toBe(60)
  })
  it("dice cuál es el siguiente escalón", () => {
    expect(siguienteEscalon(0, 5)).toEqual({ articulos: 1, pct: 4.5 })
    expect(siguienteEscalon(1, 5)).toEqual({ articulos: 2, pct: 4 })
    expect(siguienteEscalon(2, 5)).toBeNull()
  })
})

describe("slug de artículos de taller", () => {
  it("nunca queda vacío", () => {
    const { slugTaller } = require("../blog-instructores")
    expect(slugTaller("¿¿¿¿¿¿¿¿¿¿", false)).toMatch(/^articulo-[a-z0-9]+$/)
    expect(slugTaller("Fresado de aluminio", false)).toBe("fresado-de-aluminio")
    expect(slugTaller("Fresado de aluminio", true)).toMatch(/^fresado-de-aluminio-[a-z0-9]+$/)
  })
})
