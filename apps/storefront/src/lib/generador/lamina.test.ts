// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/lamina.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { bocaDePescado, desarrolloCono, desarrolloTransicion } from "./lamina"
import { leerSerie, matrizMaterial, pruebaAjuste, pruebaKerf } from "./pruebas"

const largo = (pts: number[][], cerrado = false) => {
  let s = 0
  for (let i = 1; i < pts.length + (cerrado ? 1 : 0); i++) s += Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1])
  return s
}

test("cono truncado: el arco mayor mide π·D (fibra media)", () => {
  const r = desarrolloCono({ mayor: 300, menor: 100, alto: 200, espesor: 0, partes: 1 })
  assert.deepEqual(r.errores, [])
  const pts = r.dibujo.trazos[0].pts
  // el arco exterior es la primera mitad de puntos
  const mitad = pts.slice(0, pts.length / 2)
  assert.ok(Math.abs(largo(mitad) - Math.PI * 300) < 1, `arco ${largo(mitad)}`)
  assert.ok(Math.abs(largo(pts.slice(pts.length / 2)) - Math.PI * 100) < 1)
  assert.match(desarrolloCono({ mayor: 100, menor: 200, alto: 50, espesor: 0, partes: 1 }).errores[0], /más chico/)
  assert.equal(desarrolloCono({ mayor: 300, menor: 100, alto: 200, espesor: 0, partes: 3 }).dibujo.trazos.length, 3)
})

test("transición cuadrado a redondo: el borde de arriba mide π·D y el de abajo el perímetro", () => {
  const r = desarrolloTransicion({ ancho: 400, fondo: 300, diametro: 200, alto: 250, espesor: 0, divisiones: 6 })
  assert.deepEqual(r.errores, [])
  const c = r.dibujo.trazos.find((t) => t.capa === "corte")!.pts
  // abajo: medio frente + 4 esquinas + medio frente = 6 puntos, perímetro 2·(400+300)
  assert.ok(Math.abs(largo(c.slice(0, 6)) - 1400) < 0.5, `abajo ${largo(c.slice(0, 6))}`)
  // arriba: el resto (círculo aproximado con 24 cuerdas)
  const arriba = c.slice(6)
  assert.ok(Math.abs(largo(arriba) - 24 * 2 * 100 * Math.sin(Math.PI / 24)) < 0.5, `arriba ${largo(arriba)}`)
})

test("boca de pescado: en T de tubos iguales la profundidad es el radio", () => {
  const r = bocaDePescado({ tubo: 50, principal: 50, angulo: 90, largo: 60, espesor: 0 })
  assert.deepEqual(r.errores, [])
  assert.equal(r.datos[1][1], "25 mm")
  assert.ok(Math.abs(r.ancho - Math.PI * 50) < 0.01)
  assert.match(bocaDePescado({ tubo: 80, principal: 50, angulo: 90, largo: 60, espesor: 0 }).errores[0], /más grueso/)
})

test("pruebas de kerf, ajuste y matriz", () => {
  assert.equal(pruebaKerf(null).dibujo.trazos.filter((t) => t.capa === "corte").length, 11)
  const a = pruebaAjuste(3, 0.05, null)
  assert.ok(a.ancho > 0 && a.alto > 0)
  const m = matrizMaterial({ potencias: leerSerie("20-100/20"), velocidades: leerSerie("100, 300, 500"), lado: 10, unidad: "mm/s" }, null)
  assert.equal(m.dibujo.trazos.filter((t) => t.color).length, 15)
  assert.equal(new Set(m.dibujo.trazos.filter((t) => t.color).map((t) => t.color)).size, 15)
  assert.equal(m.leyenda!.length, 16)
  assert.deepEqual(leerSerie("10-30/10"), [10, 20, 30])
})
