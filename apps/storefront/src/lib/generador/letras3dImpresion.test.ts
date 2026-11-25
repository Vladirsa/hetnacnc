// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/letras3dImpresion.test.ts`
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { volumenMalla as volumen } from "./vectores"
import { OPCIONES_IMPRESION_FABRICA, hacerLetrasImpresion, type OpcionesImpresion } from "./letras3dImpresion"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

const base: OpcionesImpresion = { ...OPCIONES_IMPRESION_FABRICA, texto: "HOLA", alto: 50, profundidad: 15, estilo: "pie" }

test("los tres estilos dan mallas con volumen positivo y del tamaño esperado", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const f = fuente()
  const pie = hacerLetrasImpresion(f, base)
  const pared = hacerLetrasImpresion(f, { ...base, estilo: "pared" })
  const luz = hacerLetrasImpresion(f, { ...base, estilo: "luz", alto: 80 })
  for (const r of [pie, pared, luz]) assert.deepEqual(r.errores, [])
  assert.ok(volumen(pie.tris) > 0 && volumen(pared.tris) > 0 && volumen(luz.tris) > 0)
  assert.equal(pie.piezas, 1)
  assert.equal(pared.piezas, 4)
  // la base agrega volumen; los barrenos y el hueco lo quitan
  const solidas = hacerLetrasImpresion(f, { ...base, estilo: "pared", barreno: 2 })
  assert.ok(volumen(pared.tris) < volumen(solidas.tris))
  assert.ok(volumen(luz.tris) < volumen(hacerLetrasImpresion(f, { ...base, estilo: "pared", alto: 80 }).tris) * 0.6, "hueca pesa mucho menos")
  // H, O, L, A: al menos un barreno por letra; la O (ancha) dos o uno
  assert.ok(pared.barrenos.length >= 4)
  assert.ok(Math.abs(pie.alto - 50) < 3)
})

test("de pie: cada letra se mete en la base (ninguna queda en el aire)", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  // HOME: la O baja de la línea base; la H, la M y la E no deben quedar arriba de la base (4 mm)
  const r = hacerLetrasImpresion(fuente(), { ...base, texto: "HOME", alto: 60 })
  const t = r.tris
  // cada letra ocupa su tramo en x (no se enciman); la base sólo tiene vértices en sus esquinas, fuera de esos tramos
  const minZPorTramo = new Map<string, number>()
  for (const l of r.letras) {
    const xs = l.contornos.flat().map((p) => p[0])
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    let z = Infinity
    for (let i = 0; i < t.length; i += 3) if (t[i] >= x0 && t[i] <= x1) z = Math.min(z, t[i + 2])
    minZPorTramo.set(l.letra, z)
  }
  for (const [, z] of minZPorTramo) assert.ok(z <= 4, `una letra empieza en z=${z.toFixed(2)} (arriba de la base)`)
})

test("acentos en letras de pie avisan que quedan sueltos", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const r = hacerLetrasImpresion(fuente(), { ...base, texto: "Sofía" })
  assert.ok(r.avisos.some((a) => /acentos/.test(a)))
  // el hueco de la O no es una pieza suelta
  assert.ok(!hacerLetrasImpresion(fuente(), { ...base, texto: "LOVE" }).avisos.some((a) => /acentos/.test(a)))
  assert.equal(hacerLetrasImpresion(fuente(), { ...base, texto: "  " }).errores.length, 1)
})

test("plantilla de montaje: PDF a tamaño real repartido en hojas carta", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, async () => {
  const { plantillaMontaje, repartoHojas } = await import("./plantillaMontaje")
  assert.deepEqual([repartoHojas(150, 100).columnas, repartoHojas(150, 100).filas], [1, 1])
  assert.equal(repartoHojas(600, 150).columnas, 4) // 600 mm de ancho: 4 hojas a lo ancho con traslape
  const r = hacerLetrasImpresion(fuente(), { ...base, texto: "HOLA", alto: 120, estilo: "pared" })
  const pdf = await plantillaMontaje({ letras: r.letras, barrenos: r.barrenos, titulo: "HOLA" })
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-")
  const { PDFDocument } = await import("pdf-lib")
  const doc = await PDFDocument.load(pdf)
  const { columnas, filas } = repartoHojas(r.ancho + 30, r.alto + 30)
  assert.equal(doc.getPageCount(), columnas * filas)
  assert.ok(Math.abs(doc.getPage(0).getWidth() - 612) < 1, "hoja carta")
})

test("plantilla: un tramo largo que cruza la hoja también se dibuja (recorte)", async () => {
  const { recortar } = await import("./plantillaMontaje")
  // palo de una I de 600 mm que atraviesa una hoja de 0..200 sin tener extremos dentro
  assert.deepEqual(recortar([-100, 50], [500, 50], 0, 0, 200, 100), [[0, 50], [200, 50]])
  assert.equal(recortar([-100, 150], [500, 150], 0, 0, 200, 100), null)
})
