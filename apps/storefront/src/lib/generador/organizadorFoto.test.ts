// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/organizadorFoto.test.ts`
// Foto sintética: mesa oscura, hoja carta girada y en perspectiva leve, y una
// "herramienta" negra de 120 × 30 mm encima.
import assert from "node:assert/strict"
import { test } from "node:test"

import { contornosHerramientas, encontrarHoja, enderezar, hacerOrganizador, homografia, OPCIONES_ORGANIZADOR } from "./organizadorFoto"
import { volumenMalla } from "./vectores"

function foto() {
  const w = 900, h = 1100, g = new Uint8Array(w * h).fill(40)
  // hoja: de mm (0..215.9, 0..279.4) a la foto, girada ~8° y con un poco de perspectiva
  const H = homografia([[0, 0], [215.9, 0], [215.9, 279.4], [0, 279.4]], [[180, 120], [760, 190], [720, 980], [110, 930]])
  const inv = homografia([[180, 120], [760, 190], [720, 980], [110, 930]], [[0, 0], [215.9, 0], [215.9, 279.4], [0, 279.4]])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const z = inv[6] * x + inv[7] * y + inv[8]
      const u = (inv[0] * x + inv[1] * y + inv[2]) / z, v = (inv[3] * x + inv[4] * y + inv[5]) / z
      if (u >= 0 && u <= 215.9 && v >= 0 && v <= 279.4) g[y * w + x] = u >= 50 && u <= 170 && v >= 120 && v <= 150 ? 25 : 235
    }
  void H
  return { g, w, h }
}

test("encuentra la hoja, la endereza y mide la herramienta", () => {
  const { g, w, h } = foto()
  const esq = encontrarHoja(g, w, h)
  assert.ok(esq, "hoja")
  const r = enderezar(g, w, h, esq!, "carta", 3)
  const c = contornosHerramientas(r.gris, r.w, r.h, 3)
  assert.equal(c.length, 1)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of c[0]) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))
  assert.ok(Math.abs(x1 - x0 - 120) < 3, `ancho ${x1 - x0}`)
  assert.ok(Math.abs(y1 - y0 - 30) < 3, `alto ${y1 - y0}`)
  // sin espejo: la herramienta está a 120–150 mm del borde de arriba (Y hacia arriba: 129.4–159.4)
  assert.ok(Math.abs(y0 - (279.4 - 150)) < 3, `abajo en ${y0}`)
  const o = hacerOrganizador(c, OPCIONES_ORGANIZADOR)
  assert.deepEqual(o.errores, [])
  assert.equal(o.piezas, 1)
  // 120 + 2·holgura + dedo (11 mm que salen a la derecha) + 2·margen
  assert.ok(Math.abs(o.ancho - (120 + 2 * 1.5 + 11 + 2 * 12)) < 4, `inserto ${o.ancho}`)
  assert.ok(volumenMalla(o.malla.tris) > 0)
  assert.match(hacerOrganizador([], OPCIONES_ORGANIZADOR).errores[0], /No encontramos/)
})
