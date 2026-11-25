// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/letras3dImpresion.test.ts`
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { hacerLetrasImpresion, type OpcionesImpresion } from "./letras3dImpresion"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

/** Volumen con signo (cm³): positivo si las caras miran hacia afuera */
const volumen = (t: number[]) => {
  let v = 0
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.slice(i, i + 9)
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  return v / 1000
}
const base: OpcionesImpresion = { texto: "HOLA", alto: 50, espaciado: 2, profundidad: 15, estilo: "pie", barreno: 8, pared: 1.6, frente: 1.2 }

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
