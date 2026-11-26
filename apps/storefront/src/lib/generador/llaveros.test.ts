// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/llaveros.test.ts`
// (las mismas variables que scripts/generar-catalogo-impresion.ts; sin ellas se saltan)
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { OPCIONES_LLAVERO_FABRICA, hacerLlavero, type OpcionesLlavero } from "./llaveros"
import { contornosDeMascara, mascaraDeImagen } from "./logoContornos"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
const base: OpcionesLlavero = { ...OPCIONES_LLAVERO_FABRICA, texto: "Max", alto: 12, forma: "rect" }

// Un "logo" de prueba: cuadro negro con un hueco blanco (como una O cuadrada)
function logoPrueba() {
  const w = 60, h = 60, d = new Uint8ClampedArray(w * h * 4).fill(255)
  for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) {
    const hueco = x >= 22 && x < 38 && y >= 22 && y < 38
    if (!hueco) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0 }
  }
  return contornosDeMascara(mascaraDeImagen(d, w, h), w, h)
}

test("logo de imagen: contorno exterior y su hueco", () => {
  const c = logoPrueba()
  assert.equal(c.length, 2)
})

test("renglón chico, ícono y logo agrandan el llavero hacia la izquierda", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const f = fuente()
  const solo = hacerLlavero(f, base)
  const conTel = hacerLlavero(f, { ...base, texto: "Max\n55 1234 5678", escalaRenglones: 50 })
  const igual = hacerLlavero(f, { ...base, texto: "Max\n55 1234 5678", escalaRenglones: 100 })
  const conIcono = hacerLlavero(f, { ...base, icono: "huella" })
  const conLogo = hacerLlavero(f, { ...base, logo: logoPrueba() })
  const soloLogo = hacerLlavero(f, { ...base, texto: "", logo: logoPrueba() })
  for (const r of [solo, conTel, igual, conIcono, conLogo, soloLogo]) assert.deepEqual(r.errores, [])
  assert.ok(conTel.alto > solo.alto && conTel.alto < igual.alto, "el teléfono chico hace la placa más alta, pero menos que a tamaño completo")
  assert.ok(conTel.ancho < igual.ancho)
  assert.ok(conIcono.ancho > solo.ancho + 10, "el ícono va a la izquierda")
  assert.ok(conLogo.ancho > solo.ancho + 10)
  assert.ok(soloLogo.malla.tris.length > 0)
  assert.equal(hacerLlavero(f, { ...base, texto: "  " }).errores.length, 1)
})
