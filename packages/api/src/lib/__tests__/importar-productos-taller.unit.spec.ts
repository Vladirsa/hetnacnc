import ExcelJS from "exceljs"

import { COLUMNAS, HOJA, TITULO_FOTOS_TALLER, leerPlantilla, plantillaProductos } from "../importar-productos/plantilla"
import { planear, type Categoria, type Existente } from "../importar-productos/importar"
import { mapaFotos, prefijarHandles } from "../importar-productos/taller"

const BASE = "http://localhost:9000/static"
type Fila = Partial<Record<(typeof COLUMNAS)[number]["clave"], unknown>>
async function archivoTaller(filas: Fila[]) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await plantillaProductos(["Herramientas > Fresas"], { taller: true })) as any)
  const ws = wb.getWorksheet(HOJA)!
  for (const f of filas) ws.addRow(COLUMNAS.map((c) => f[c.clave] ?? null))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
const base = { categoria: "Fresas", precio: 189, existencias: 10, peso: 0.05, largo: 12, ancho: 4, alto: 2 }
const cats: Categoria[] = [
  { id: "c1", name: "Herramientas", handle: "herramientas", parent_category_id: null },
  { id: "c2", name: "Fresas", handle: "fresas", parent_category_id: "c1" },
]

describe("Excel de productos para talleres", () => {
  beforeAll(() => { delete process.env.FILE_BACKEND_URL })

  it("la plantilla del taller pide fotos por nombre de archivo, sin la marca HETNA en los ejemplos", async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await plantillaProductos(["Fresas"], { taller: true })) as any)
    const titulos = (wb.getWorksheet(HOJA)!.getRow(1).values as unknown[]).map(String)
    expect(titulos).toContain(TITULO_FOTOS_TALLER)
    const ej = wb.getWorksheet("Ejemplos (no se importan)")!
    const textos: string[] = []
    ej.eachRow((r) => r.eachCell((c) => textos.push(String(c.value))))
    expect(textos.some((t) => /^https?:/.test(t))).toBe(false)
    expect(textos).not.toContain("HETNA")
  })

  it("las fotos sólo pueden ser archivos subidos a la tienda", () => {
    const m = mapaFotos(JSON.stringify({
      "Fresa 6mm.JPG": `${BASE}/123-fresa.jpg`,
      "otra.jpg": "https://sitio-ajeno.com/foto.jpg",
      "rara.jpg": `${BASE}evil/x.jpg`,
      "nada.jpg": 42,
    }))
    expect([...m.keys()]).toEqual(["fresa 6mm.jpg"])
    expect(mapaFotos("no es json").size).toBe(0)
    expect(mapaFotos([`${BASE}/a.jpg`]).size).toBe(0)
  })

  it("cambia nombres de archivo por ligas y rechaza ligas escritas o fotos que no se eligieron", async () => {
    const fotos = mapaFotos({ "fresa-6mm.jpg": `${BASE}/1-fresa.jpg` })
    const buf = await archivoTaller([
      { ...base, nombre: "Fresa recta de carburo 6 mm", sku: "A-1", imagenes: "Fresa-6MM.jpg" },
      { ...base, nombre: "Fresa recta de carburo 3 mm", sku: "A-2", imagenes: "https://otro.com/x.jpg" },
      { ...base, nombre: "Fresa recta de carburo 8 mm", sku: "A-3", imagenes: "no-subida.jpg" },
      { ...base, nombre: "Corta", sku: "A-4", imagenes: "fresa-6mm.jpg" },
    ])
    const r = await leerPlantilla(buf, { fotos })
    expect(r.productos.find((p) => p.variantes[0].sku === "A-1")!.imagenes).toEqual([`${BASE}/1-fresa.jpg`])
    const porFila = (f: number) => r.errores.filter((e) => e.fila === f).map((e) => e.mensaje).join(" ")
    expect(porFila(3)).toMatch(/no se aceptan ligas/)
    expect(porFila(4)).toMatch(/No elegiste la foto/)
    expect(porFila(5)).toMatch(/8 a 120/)
  })

  it("el identificador lleva el handle del taller, y el agrupador de otro taller no se actualiza", async () => {
    const fotos = mapaFotos({ "f.jpg": `${BASE}/f.jpg` })
    const lectura = prefijarHandles(
      await leerPlantilla(await archivoTaller([{ ...base, agrupador: "fresa-6", nombre: "Fresa recta de carburo 6 mm", sku: "B-1", imagenes: "f.jpg" }]), { fotos }),
      "taller-b"
    )
    expect(lectura.productos[0].handle).toBe("taller-b-fresa-6")
    // Volver a prefijar no lo duplica
    expect(prefijarHandles(lectura, "taller-b").productos[0].handle).toBe("taller-b-fresa-6")

    // El SKU B-1 ya es de un producto de otro taller: error, nunca actualización.
    // (revisar() saca de "existentes" los productos que no son del taller.)
    const ajeno = new Map<string, string>([["B-1", "taller-a-fresa-6"]])
    const plan = planear(lectura, cats, new Map<string, Existente>(), ajeno)
    expect(plan.pasos).toHaveLength(0)
    expect(plan.errores[0].mensaje).toMatch(/ya es de otro producto/)

    // Su propio producto (mismo handle, mismo SKU) sí se actualiza
    const propio = new Map<string, Existente>([["taller-b-fresa-6", { id: "p1", handle: "taller-b-fresa-6", variants: [{ id: "v1", sku: "B-1" }] }]])
    const plan2 = planear(lectura, cats, propio, new Map([["B-1", "taller-b-fresa-6"]]))
    expect(plan2.pasos[0].accion).toBe("actualizar")
  })
})
