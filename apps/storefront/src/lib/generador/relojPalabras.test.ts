// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/relojPalabras.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { COLUMNAS, CUADRICULA, PALABRAS, celdasDe, hacerRelojPalabras, palabrasDeLaHora } from "./relojPalabras"

test("cada palabra está escrita en la cuadrícula donde dice", () => {
  assert.ok(CUADRICULA.every((r) => r.length === COLUMNAS))
  for (const [p, d] of Object.entries(PALABRAS)) assert.equal(CUADRICULA[d.renglon].slice(d.desde, d.desde + d.largo), p.replace("+", ""), p)
})

test("las horas en español", () => {
  assert.deepEqual(palabrasDeLaHora(1, 0), ["ES", "LA", "UNA"])
  assert.deepEqual(palabrasDeLaHora(15, 15), ["SON", "LAS", "TRES", "Y", "CUARTO+"])
  assert.deepEqual(palabrasDeLaHora(12, 45), ["ES", "LA", "UNA", "MENOS", "CUARTO+"])
  assert.deepEqual(palabrasDeLaHora(9, 32), ["SON", "LAS", "NUEVE", "Y", "MEDIA+"])
  assert.deepEqual(palabrasDeLaHora(9, 37), ["SON", "LAS", "DIEZ", "MENOS", "VEINTICINCO+"])
  assert.deepEqual(palabrasDeLaHora(0, 55), ["ES", "LA", "UNA", "MENOS", "CINCO+"])
  // todas las horas y minutos se pueden escribir, en orden de lectura
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 5) {
      const c = celdasDe(palabrasDeLaHora(h, m)).map(([r, k]) => r * COLUMNAS + k)
      assert.ok(c.every((x, i) => i === 0 || x >= c[i - 1] - 0), `${h}:${m} en orden`)
    }
})

test("tres capas y la tabla de LEDs", () => {
  const r = hacerRelojPalabras({ lado: 300, margen: 30, letra: 60 }, null)
  assert.equal(r.dibujo.trazos.filter((t) => t.pts.length === 4 && t.pts[2][0] - t.pts[0][0] === 300).length, 3)
  assert.equal(r.tabla.length, Object.keys(PALABRAS).length + 1)
})
