// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/placas3d.test.ts`
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { aBraille, hacerBraille, hacerEtiqueta, OPCIONES_BRAILLE_FABRICA, OPCIONES_ETIQUETA_FABRICA } from "./placas3d"
import { volumenMalla } from "./vectores"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

test("braille español: mayúscula, número, acentos y ñ", () => {
  // "Año 25": ⠨ ⠁ ⠻ ⠕ (espacio) ⠼ ⠃ ⠑
  assert.deepEqual(aBraille("Año 25").celdas, [[4, 6], [1], [1, 2, 4, 5, 6], [1, 3, 5], [], [3, 4, 5, 6], [1, 2], [1, 5]])
  assert.deepEqual(aBraille("é").celdas, [[2, 3, 4, 6]])
  // letra a-j justo después de un número lleva el interruptor
  assert.deepEqual(aBraille("3a").celdas, [[3, 4, 5, 6], [1, 4], [5, 6], [1]])
  assert.deepEqual(aBraille("€").sinBraille, ["€"])
})

test("placa en braille: puntos a la medida y placa con margen", () => {
  const r = hacerBraille(null, { ...OPCIONES_BRAILLE_FABRICA, texto: "Baño", textoVisible: false })
  assert.deepEqual(r.errores, [])
  assert.deepEqual(r.malla.partes!.map((p) => p.nombre), ["Placa", "Braille y letras"])
  assert.ok(volumenMalla(r.malla.tris) > 0)
  // ⠨ ⠃ ⠁ ⠻ ⠕: 5 celdas
  assert.ok(Math.abs(r.ancho - (5 * 6 - 3.5 + 1.6 + 10)) < 0.01)
  assert.match(hacerBraille(null, { ...OPCIONES_BRAILLE_FABRICA, texto: "x".repeat(41) }).errores[0], /40 celdas/)
})

test("etiqueta: texto ajustado a la medida y con ícono", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const r = hacerEtiqueta(fuente(), { ...OPCIONES_ETIQUETA_FABRICA, texto: "Tornillos M3", icono: "estrella" })
  assert.deepEqual(r.errores, [])
  assert.equal(r.ancho, 36)
  let xmax = -Infinity, ymax = -Infinity
  for (let i = 0; i < r.malla.tris.length; i += 3) (xmax = Math.max(xmax, r.malla.tris[i])), (ymax = Math.max(ymax, r.malla.tris[i + 1]))
  assert.ok(xmax <= 36 + 1e-6 && ymax <= 11 + 1e-6, "nada se sale de la placa")
  const b = hacerBraille(fuente(), { ...OPCIONES_BRAILLE_FABRICA, texto: "Sala 2" })
  assert.deepEqual(b.errores, [])
})
