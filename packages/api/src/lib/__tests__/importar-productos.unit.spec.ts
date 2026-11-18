import ExcelJS from "exceljs"

import { COLUMNAS, HOJA, gtinDe, gtinValido, leerPlantilla, numero, plantillaProductos } from "../importar-productos/plantilla"
import { entradaCrear, metadataProducto, planear, preciosOferta, resolverCategoria, type Categoria } from "../importar-productos/importar"

type Fila = Partial<Record<(typeof COLUMNAS)[number]["clave"], unknown>>
async function archivo(filas: Fila[], opciones: { quitar?: string } = {}) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await plantillaProductos(["Fresas"])) as any)
  const ws = wb.getWorksheet(HOJA)!
  if (opciones.quitar) {
    const col = COLUMNAS.findIndex((c) => c.clave === opciones.quitar) + 1
    ws.getRow(1).getCell(col).value = "otra cosa"
  }
  for (const f of filas) ws.addRow(COLUMNAS.map((c) => f[c.clave] ?? null))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
const base = { categoria: "Fresas", precio: 189, existencias: 10, peso: 0.05, largo: 12, ancho: 4, alto: 2 }
const cats: Categoria[] = [
  { id: "c1", name: "Herramientas", handle: "herramientas", parent_category_id: null },
  { id: "c2", name: "Fresas", handle: "fresas", parent_category_id: "c1" },
  { id: "c3", name: "Consumibles", handle: "consumibles", parent_category_id: null },
  { id: "c4", name: "Filamentos", handle: "filamentos", parent_category_id: "c3" },
  { id: "c5", name: "Filamentos", handle: "filamentos-3d", parent_category_id: "c1" },
  { id: "c6", name: "Oculta", handle: "oculta", parent_category_id: null, is_internal: true },
]

describe("Plantilla de productos", () => {
  it("la plantilla trae Productos vacía, Ejemplos e Instrucciones, y los ejemplos NO se importan", async () => {
    const buf = await plantillaProductos(["Fresas", "Consumibles"])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as any)
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Productos", "Ejemplos (no se importan)", "Instrucciones"])
    expect(wb.getWorksheet("Ejemplos (no se importan)")!.rowCount).toBeGreaterThan(3)
    const r = await leerPlantilla(buf)
    expect(r.productos).toHaveLength(0)
    expect(r.errores[0].mensaje).toMatch(/vacía/)
  })

  it("agrupa variantes por agrupador y lee precios con formato", async () => {
    const r = await leerPlantilla(await archivo([
      { ...base, agrupador: "Fresa Recta 2F", nombre: "Fresa recta 2 filos", variante: "Diámetro", valor: "3.175 mm", sku: "fr-3175", precio: "$189.50" },
      { ...base, agrupador: "Fresa Recta 2F", nombre: "Fresa recta 2 filos", variante: "Diámetro", valor: "6 mm", sku: "FR-6", precio: "1,249.00", existencias: 0 },
      { ...base, nombre: "Aceite soluble 1 L", sku: "REF-1L", estado: "borrador", imagenes: "https://x.mx/a.jpg, https://x.mx/b.jpg", etiquetas: "Aceite, Corte" },
    ]))
    expect(r.errores).toEqual([])
    expect(r.productos).toHaveLength(2)
    const [fresa, aceite] = r.productos
    expect(fresa.handle).toBe("fresa-recta-2f")
    expect(fresa.opcion).toBe("Diámetro")
    expect(fresa.variantes.map((v) => [v.sku, v.valor, v.precio, v.existencias])).toEqual([["FR-3175", "3.175 mm", 189.5, 10], ["FR-6", "6 mm", 1249, 0]])
    expect(aceite.opcion).toBe("Presentación")
    expect(aceite.variantes[0].valor).toBeNull()
    expect(aceite.estado).toBe("draft")
    expect(aceite.imagenes).toEqual(["https://x.mx/a.jpg", "https://x.mx/b.jpg"])
    expect(aceite.etiquetas).toEqual(["aceite", "corte"])
  })

  it("marca errores por renglón", async () => {
    const r = await leerPlantilla(await archivo([
      { ...base, nombre: "Fresa A", sku: "A1", precio: "gratis" },
      { ...base, nombre: "Fresa B", sku: "A1", existencias: 2.5 },
      { ...base, nombre: "Fresa C", sku: "C1", peso: 0, imagenes: "ftp://mal" },
      { ...base, nombre: "Varias", agrupador: "v", sku: "V1", valor: "1" },
      { ...base, nombre: "Varias", agrupador: "v", sku: "V2", valor: "2" },
      { ...base, nombre: "X", sku: "X1", estado: "vendido" },
    ]))
    const por = (fila: number) => r.errores.filter((e) => e.fila === fila).map((e) => e.columna)
    expect(por(2)).toEqual(["Precio MXN (IVA incluido) *"])
    expect(por(3)).toEqual(expect.arrayContaining(["SKU *", "Existencias *"]))
    expect(por(4)).toEqual(expect.arrayContaining(["Peso kg *", "Imágenes (ligas)"]))
    expect(por(5)).toContain("Variante (qué cambia)") // varios renglones sin decir qué cambia
    expect(por(7)).toEqual(expect.arrayContaining(["Nombre del producto *", "Estado"]))
  })

  it("si falta una columna obligatoria lo dice", async () => {
    const r = await leerPlantilla(await archivo([{ ...base, nombre: "Algo", sku: "Z1" }], { quitar: "precio" }))
    expect(r.errores[0].mensaje).toMatch(/Falta esta columna/)
  })

  it("números con formato mexicano", () => {
    expect(numero("$1,234.50")).toBe(1234.5)
    expect(numero("12,5")).toBe(12.5)
    expect(numero(" 99 MXN")).toBe(99)
    expect(numero("abc")).toBeNull()
  })
})

describe("Planeación contra la tienda", () => {
  it("categorías por nombre, con Padre > Hija para desempatar; las internas no cuentan", () => {
    expect(resolverCategoria("fresas", cats).cat?.id).toBe("c2")
    expect(resolverCategoria("Filamentos", cats).error).toMatch(/varias/)
    expect(resolverCategoria("Consumibles > Filamentos", cats).cat?.id).toBe("c4")
    expect(resolverCategoria("Oculta", cats).error).toMatch(/No existe/)
  })

  it("crea lo nuevo, actualiza lo existente y bloquea medidas nuevas en productos existentes o SKU ajenos", async () => {
    const lectura = await leerPlantilla(await archivo([
      { ...base, nombre: "Fresa nueva", sku: "N1" },
      { ...base, agrupador: "ya-existe", nombre: "Ya existe", variante: "Medida", valor: "1", sku: "E1" },
      { ...base, agrupador: "con-nueva", nombre: "Con nueva", variante: "Medida", valor: "2", sku: "E9" },
      { ...base, nombre: "Ajeno", sku: "AJ1" },
      { ...base, nombre: "Sin categoría", sku: "S1", categoria: "Juguetes" },
    ]))
    const existentes = new Map([
      ["ya-existe", { id: "p1", handle: "ya-existe", variants: [{ id: "v1", sku: "E1" }, { id: "v2", sku: "E2" }] }],
      ["con-nueva", { id: "p2", handle: "con-nueva", variants: [{ id: "v3", sku: "E3" }] }],
    ])
    const plan = planear(lectura, cats, existentes, new Map([["AJ1", "otro-producto"], ["E1", "ya-existe"]]))
    expect(plan.pasos.map((p) => [p.producto.handle, p.accion])).toEqual([["fresa-nueva", "crear"], ["ya-existe", "actualizar"]])
    expect(plan.errores.map((e) => e.fila)).toEqual([4, 5, 6])
    expect(plan.avisos.some((a) => /E2/.test(a.mensaje))).toBe(true) // E2 no viene: se deja como está
  })

  it("sin agrupador, un producto con nombre cambiado se reconoce por sus SKU y se actualiza", async () => {
    const lectura = await leerPlantilla(await archivo([{ ...base, nombre: "Aceite soluble 1 litro (nuevo nombre)", sku: "REF-1L" }]))
    const existentes = new Map([["aceite-soluble-1-l", { id: "p9", handle: "aceite-soluble-1-l", variants: [{ id: "v9", sku: "REF-1L" }] }]])
    const plan = planear(lectura, cats, existentes, new Map([["REF-1L", "aceite-soluble-1-l"]]))
    expect(plan.errores).toEqual([])
    expect(plan.pasos.map((p) => [p.producto.handle, p.accion, p.existente?.id])).toEqual([["aceite-soluble-1-l", "actualizar", "p9"]])
  })

  it("arma la entrada del workflow: variantes con opción, medidas, SEO y sin precio en la variante", async () => {
    const lectura = await leerPlantilla(await archivo([
      { ...base, agrupador: "pla", nombre: "Filamento PLA 1 kg", variante: "Color", valor: "Negro", sku: "PLA-N", peso: 1.3, seo_titulo: "PLA negro", marca: "HETNA", descripcion: "Para impresoras 3D.\n- 1.75 mm" },
      { ...base, agrupador: "pla", nombre: "Filamento PLA 1 kg", variante: "Color", valor: "Blanco", sku: "PLA-B", peso: 1.2 },
    ]))
    const e = entradaCrear(lectura.productos[0], { categoria_id: "c4", perfil_id: "sp1", canales: ["sc1"], tag_ids: [], imagenes: ["https://cdn/x.jpg"] })
    expect(e.status).toBe("published")
    expect(e.options).toEqual([{ title: "Color", values: ["Negro", "Blanco"] }])
    expect(e.variants.map((v) => [v.sku, v.options, v.prices, v.manage_inventory])).toEqual([["PLA-N", { Color: "Negro" }, [], false], ["PLA-B", { Color: "Blanco" }, [], false]])
    expect(e.weight).toBe(1.3)
    expect(e.metadata).toMatchObject({ seo_title: "PLA negro", marca: "HETNA" })
    expect(e.description).toContain("<li>1.75 mm</li>")
    expect(e.thumbnail).toBe("https://cdn/x.jpg")
    expect(preciosOferta(379, true)).toEqual([{ currency_code: "mxn", amount: 379 }, { currency_code: "usd", amount: expect.any(Number) }])
    expect(preciosOferta(379, false)).toHaveLength(1)
  })
  it("lee condición, código de barras y número de parte para Google Shopping", async () => {
    const r = await leerPlantilla(await archivo([
      { ...base, nombre: "Husillo usado 2.2 kW", sku: "HUS-1", condicion: "Usado", gtin: "7501234567893", mpn: "GDZ-80-2.2" },
      { ...base, nombre: "Fresa X", sku: "FX-1", gtin: "12345", condicion: "roto" },
      { ...base, nombre: "Fresa Y", sku: "FY-1", gtin: "7501234567891" },
      { ...base, agrupador: "fz", nombre: "Fresa Z", variante: "Diámetro", valor: "3 mm", sku: "FZ-3", gtin: "7501234567893" },
      { ...base, agrupador: "fz", nombre: "Fresa Z", variante: "Diámetro", valor: "6 mm", sku: "FZ-6", gtin: "4006381333931" },
    ]))
    expect(r.errores.map((e) => [e.fila, e.columna])).toEqual([
      [3, "Condición"], [3, "Código de barras (GTIN)"], // no es número de 8/12/13/14
      [4, "Código de barras (GTIN)"], // dígito verificador mal
      [5, "Código de barras (GTIN)"], // dos medidas con códigos distintos
    ])
    const [h] = r.productos
    expect([h.condicion, h.gtin, h.mpn]).toEqual(["used", "7501234567893", "GDZ-80-2.2"])
    expect(metadataProducto(h)).toMatchObject({ condicion: "used", gtin: "7501234567893", mpn: "GDZ-80-2.2" })
  })

  it("al actualizar, las celdas vacías no borran lo que ya tenía el producto", async () => {
    const lectura = await leerPlantilla(await archivo([{ ...base, nombre: "Aceite soluble 1 L", sku: "REF-1L" }]))
    const p = lectura.productos[0]
    expect(p.estado).toBeNull()
    expect(p.descripcion).toBe("")
    // Sólo llaves con valor: Medusa mezcla la metadata, lo que no se manda se queda
    expect(metadataProducto(p)).toEqual({ importado: true })
    // Nuevo sin Estado: se publica
    expect(entradaCrear(p, { categoria_id: "c2", perfil_id: "sp", canales: [], tag_ids: [], imagenes: [] }).status).toBe("published")
  })

  it("código de barras: dígito verificador y ceros que Excel quitó", () => {
    expect(gtinValido("7501234567893")).toBe(true)
    expect(gtinValido("4006381333931")).toBe(true)
    expect(gtinValido("00000000")).toBe(false)
    expect(gtinDe("750-1234-567893")).toBe("7501234567893")
    expect(gtinDe(12345678905)).toBe("012345678905") // UPC-A con cero al inicio, leído como número
    expect(gtinDe("12345678905")).toBeNull() // como texto no se adivina
    expect(gtinDe("")).toBeUndefined()
  })
})
