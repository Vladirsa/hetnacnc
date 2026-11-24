import { readFileSync } from "fs"
import { join } from "path"
import { runInNewContext } from "vm"

// La regla vive en la tienda (apps/storefront/src/lib/hetna/slug-directorio.ts),
// fuera de packages/api. Se carga con require en tiempo de ejecución para que el
// build del API (tsc, rootDir = packages/api) no intente compilar ese archivo.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esSlugDirectorio, slugDirectorio } = require(join(__dirname, "../../../../../apps/storefront/src/lib/hetna/slug-directorio")) as {
  slugDirectorio: (id: unknown) => string
  esSlugDirectorio: (slug: unknown) => boolean
}


// Slugs del directorio de perfiles no reclamados (/talleres/directorio/<slug>).
// La regla vive en la tienda y, copiada, en los nodos Code de n8n que arman el
// directorio y buscan la fila de un slug (no pueden importar archivos).

const N8N = join(__dirname, "../../../../../scripts/prospectos/n8n/directorio")

/** La función slugDe tal como corre en un nodo Code de n8n. */
function slugDeN8n(archivo: string): (id: unknown) => string {
  const codigo = readFileSync(join(N8N, archivo), "utf8")
  const inicio = codigo.indexOf("const MARCAS_ACENTO")
  const fin = codigo.indexOf("\n}\n", codigo.indexOf("function slugDe")) + 2
  expect(inicio).toBeGreaterThanOrEqual(0)
  return runInNewContext(codigo.slice(inicio, fin) + "; slugDe")
}

// Los 5 perfiles del mapa del sitio que respondían 404 (revisión del 24 nov 2026)
const DE_FACEBOOK: [string, string][] = [
  ["facebook.com/frmaquinariacnc", "facebook-com-frmaquinariacnc"],
  ["facebook.com/icutmerida", "facebook-com-icutmerida"],
  ["facebook.com/MaquinadosMurillo", "facebook-com-maquinadosmurillo"],
  ["facebook.com/maquinasplasmamty/", "facebook-com-maquinasplasmamty"],
  [
    "facebook.com/p/Dispro-Impresión-HD-en-Lona-Vinil-y-Corte-CNC-Router-y-Láser-en-Puebla-100063836011435",
    "facebook-com-p-dispro-impresion-hd-en-lona-vinil-y-corte-cnc-router-y-laser-en-puebla-100063836011435",
  ],
]

describe("slug del directorio", () => {
  it("quita diagonales, acentos y mayúsculas de las ligas de Facebook", () => {
    for (const [id, slug] of DE_FACEBOOK) {
      expect(slugDirectorio(id)).toBe(slug)
      expect(esSlugDirectorio(slugDirectorio(id))).toBe(true)
    }
  })

  it("a los dominios les da lo mismo que la regla vieja (sus URLs no cambian)", () => {
    const viejo = (id: string) => id.trim().toLowerCase().split(".").join("-")
    for (const id of ["maquinadoscnc.com.mx", "corte-laser.mx", "Taller123.com", "ig-maquinados"]) {
      expect(slugDirectorio(id)).toBe(viejo(id))
    }
  })

  it("deja sólo letras, números y guiones sueltos", () => {
    expect(slugDirectorio("  Diseño & Corte__CNC  (Querétaro) ")).toBe("diseno-corte-cnc-queretaro")
    expect(slugDirectorio("instagram.com/ñandú_cnc?igsh=x")).toBe("instagram-com-nandu-cnc-igsh-x")
    expect(slugDirectorio("--a//b..c--")).toBe("a-b-c")
    expect(slugDirectorio("")).toBe("")
    expect(slugDirectorio(null)).toBe("")
    expect(slugDirectorio(undefined)).toBe("")
    expect(slugDirectorio("///")).toBe("")
  })

  it("es idempotente: el slug viejo lleva al mismo slug nuevo (para el 301)", () => {
    const viejo = (id: string) => id.trim().toLowerCase().split(".").join("-")
    for (const [id, slug] of DE_FACEBOOK) {
      expect(slugDirectorio(slug)).toBe(slug)
      expect(slugDirectorio(viejo(id))).toBe(slug)
    }
  })

  it("corta los muy largos sin dejar un guion al final", () => {
    const s = slugDirectorio("a".repeat(119) + "-bbbb")
    expect(s).toBe("a".repeat(119))
    expect(slugDirectorio("x".repeat(300)).length).toBe(120)
    expect(esSlugDirectorio(slugDirectorio("palabra ".repeat(40)))).toBe(true)
  })

  it("esSlugDirectorio rechaza lo que la ruta [slug] no puede servir", () => {
    expect(esSlugDirectorio("facebook-com-icutmerida")).toBe(true)
    expect(esSlugDirectorio("facebook-com/icutmerida")).toBe(false)
    expect(esSlugDirectorio("impresión")).toBe(false)
    expect(esSlugDirectorio("Mayus")).toBe(false)
    expect(esSlugDirectorio("doble--guion")).toBe(false)
    expect(esSlugDirectorio("-orilla")).toBe(false)
    expect(esSlugDirectorio("")).toBe(false)
    expect(esSlugDirectorio(undefined)).toBe(false)
    expect(esSlugDirectorio("a".repeat(121))).toBe(false)
  })

  it("los nodos de n8n usan exactamente la misma regla", () => {
    const casos = [...DE_FACEBOOK.map(([id]) => id), "maquinadoscnc.com.mx", "  Diseño & Corte__CNC ", "a".repeat(119) + "-bbbb", "", null]
    for (const archivo of ["comun.js", "directorio_publico.js"]) {
      const slugDe = slugDeN8n(archivo)
      for (const id of casos) expect(slugDe(id)).toBe(slugDirectorio(id))
    }
  })
})
