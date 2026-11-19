import { CATEGORIAS_RECURSO, dominioDe, leerRecurso, ligaValida } from "../recursos-academia"

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

  it("las categorías coinciden con las de la tienda", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const tienda = fs.readFileSync(
      path.join(__dirname, "../../../../../apps/storefront/src/lib/hetna/recursos-academia.ts"),
      "utf8"
    )
    for (const [clave, nombre] of CATEGORIAS_RECURSO) expect(tienda).toContain(`["${clave}", "${nombre}"]`)
    expect(dominioDe("https://www.foo.mx/x")).toBe("foo.mx")
  })
})
