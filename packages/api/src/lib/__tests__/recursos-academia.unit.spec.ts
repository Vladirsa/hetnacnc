import { CATEGORIAS_RECURSO, TIPOS_RECURSO, dominioDe, leerRecurso, ligaValida } from "../recursos-academia"

describe("biblioteca de recursos de la Academia", () => {
  it("sólo acepta ligas http(s) completas", () => {
    expect(ligaValida("https://manuales-faciles.blogspot.com/2020/08/x.html")).toBe("https://manuales-faciles.blogspot.com/2020/08/x.html")
    expect(ligaValida("http://r-luis.xbot.es/")).toBe("http://r-luis.xbot.es/")
    expect(ligaValida("javascript:alert(1)")).toBeNull()
    expect(ligaValida("data:text/html,hola")).toBeNull()
    expect(ligaValida("ftp://sitio.com/a")).toBeNull()
    expect(ligaValida("https://user:clave@sitio.com")).toBeNull()
    expect(ligaValida("https://localhost/x")).toBeNull()
    expect(ligaValida("sitio.com")).toBeNull()
  })

  it("pide título, liga y categoría al crear; el crédito sale del dominio si falta", () => {
    expect(leerRecurso({}).error).toBeTruthy()
    expect(leerRecurso({ titulo: "Planos", url: "nada", categoria: "otros" }).error).toMatch(/liga/)
    expect(leerRecurso({ titulo: "Planos", url: "https://www.ejemplo.com/a", categoria: "inventada" }).error).toMatch(/categoría/)
    const { datos } = leerRecurso({ titulo: "  Planos   de muebles ", url: "https://www.ejemplo.com/a", categoria: "muebles-melamina", tipo: "raro" })
    expect(datos).toMatchObject({ titulo: "Planos de muebles", fuente: "ejemplo.com", categoria: "muebles-melamina", tipo: "guia", descripcion: "" })
  })

  it("la imagen de vista previa debe ser https", () => {
    const base = { titulo: "Planos", url: "https://ejemplo.com", categoria: "otros" }
    expect(leerRecurso({ ...base, imagen_url: "http://ejemplo.com/a.jpg" }).error).toMatch(/imagen/)
    expect(leerRecurso({ ...base, imagen_url: "" }).datos?.imagen_url).toBeNull()
    expect(leerRecurso({ ...base, imagen_url: "https://hetnacnc.com/a.jpg" }).datos?.imagen_url).toBe("https://hetnacnc.com/a.jpg")
  })

  it("al editar sólo toca lo que llega", () => {
    expect(leerRecurso({ publicado: false }, true).datos).toEqual({ publicado: false })
    expect(leerRecurso({ orden: "99999" }, true).datos).toEqual({ orden: 9999 })
  })

  it("las categorías y tipos coinciden en la tienda y el dashboard", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const raiz = path.join(__dirname, "../../../../..")
    for (const archivo of ["apps/storefront/src/lib/hetna/recursos-academia.ts", "apps/admin/src/routes/recursos/page.tsx"]) {
      const s = fs.readFileSync(path.join(raiz, archivo), "utf8")
      for (const [clave, nombre] of [...CATEGORIAS_RECURSO, ...TIPOS_RECURSO]) expect(s).toContain(`["${clave}", "${nombre}"]`)
    }
  })

  it("saca el dominio de la liga", () => {
    expect(dominioDe("https://www.foo.mx/x")).toBe("foo.mx")
  })
})

describe("biblioteca: detalles de la revisión", () => {
  it("publicado y destacado sólo aceptan booleanos", () => {
    expect(leerRecurso({ publicado: "false", destacado: "true" }, true).datos).toEqual({})
    expect(leerRecurso({ publicado: false, destacado: true }, true).datos).toEqual({ publicado: false, destacado: true })
  })
  it("acepta extensiones internacionales y sigue rechazando IPs", () => {
    expect(ligaValida("https://ejemplo.xn--p1ai/")).toBe("https://ejemplo.xn--p1ai/")
    expect(ligaValida("http://192.168.1.10/")).toBeNull()
  })
})

describe("biblioteca: recursos de todo el mundo", () => {
  const { RECURSOS_MUNDO } = require("../../scripts/datos-recursos-mundo")
  it("todos son válidos y no se repiten", () => {
    const urls = new Set<string>()
    for (const r of RECURSOS_MUNDO) {
      const { datos, error } = leerRecurso({ ...r, publicado: true })
      expect({ url: r.url, error }).toEqual({ url: r.url, error: undefined })
      expect(urls.has(datos!.url as string)).toBe(false)
      urls.add(datos!.url as string)
    }
    expect(RECURSOS_MUNDO.length).toBeGreaterThanOrEqual(100)
  })
  it("no incluye sitios que compiten con HETNA", () => {
    const competencia = /xometry|sendcutsend|protolabs|ponoko|pcbway|jlcpcb|hubs\.com|fictiv|emachineshop|oshcut|cutlistoptimizer|grid\.space|boxes\.hackerspace|printables|thingiverse|cults3d|etsy|3axis|udemy|domestika|cnczone|reddit|easel\.inventables|fablabs\.io|xtool|glowforge|cnccookbook/i
    for (const r of RECURSOS_MUNDO) expect(competencia.test(r.url)).toBe(false)
  })
})
