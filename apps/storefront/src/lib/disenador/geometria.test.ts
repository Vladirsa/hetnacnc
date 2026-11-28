// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/disenador/geometria.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  aDibujo,
  ajustarCaja,
  alinear,
  aplanar,
  arco3Puntos,
  areaPts,
  arregloCircular,
  arregloLineal,
  cajaDe,
  circulo,
  documentoNuevo,
  documentoValido,
  espejo,
  estrella,
  insertarNodo,
  intersectar,
  largo,
  linea,
  offset,
  partirEnNodo,
  puntoMasCercano,
  rectangulo,
  redondearEsquinas,
  restar,
  soldar,
  suavizarNodo,
  unirAbiertas,
} from "./geometria"

const cerca = (a: number, b: number, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const areaForma = (f: ReturnType<typeof rectangulo>) => Math.abs(areaPts(aplanar(f)))

test("figuras: medidas y áreas", () => {
  const r = rectangulo(10, 20, 100, 50)
  assert.deepEqual(cajaDe([r]), { x0: 10, y0: 20, x1: 110, y1: 70 })
  cerca(areaForma(r), 5000)
  // esquinas redondeadas: área = w·h − (4 − π)·r²
  cerca(areaForma(rectangulo(0, 0, 100, 50, 10)), 5000 - (4 - Math.PI) * 100, 1)
  const c = circulo(0, 0, 50)
  cerca(areaForma(c), Math.PI * 2500, 2)
  cerca(largo(c), Math.PI * 100, 0.2)
  const e = estrella(0, 0, 50, 20, 5)
  assert.equal(e.nodos.length, 10)
})

test("arco por tres puntos: media vuelta arriba", () => {
  const a = arco3Puntos([-10, 0], [10, 0], [0, 10])!
  const c = cajaDe([a])!
  cerca(c.y1, 10)
  cerca(c.y0, 0)
  cerca(largo(a), Math.PI * 10, 0.05)
  // por abajo
  const b = arco3Puntos([-10, 0], [10, 0], [0, -10])!
  cerca(cajaDe([b])!.y0, -10)
})

test("soldar, restar e intersectar", () => {
  const a = rectangulo(0, 0, 100, 100)
  const b = rectangulo(50, 50, 100, 100)
  const u = soldar([a, b])
  assert.equal(u.length, 1)
  cerca(areaForma(u[0]), 17500, 1)
  const d = restar([a], [b])
  cerca(areaForma(d[0]), 7500, 1)
  const i = intersectar([a, b])
  cerca(areaForma(i[0]), 2500, 1)
  // hueco: un círculo dentro de un cuadro queda como forma aparte (contorno interior)
  const h = restar([a], [circulo(50, 50, 20)])
  assert.equal(h.length, 2)
})

test("offset afuera y adentro", () => {
  const r = rectangulo(0, 0, 100, 50)
  const afuera = offset([r], 5, "rectas")
  assert.deepEqual(
    Object.values(cajaDe(afuera)!).map((v) => Math.round(v)),
    [-5, -5, 105, 55]
  )
  const adentro = offset([r], -5)
  cerca(areaForma(adentro[0]), 90 * 40, 1)
  // redondas: área = (w+2d)(h+2d) − (4 − π)d²
  cerca(areaForma(offset([r], 5)[0]), 110 * 60 - (4 - Math.PI) * 25, 1)
  // línea abierta: contorno alrededor
  const l = offset([linea([[0, 0], [100, 0]])], 3)
  cerca(cajaDe(l)!.y1, 3, 0.05)
})

test("redondear esquinas de un rectángulo", () => {
  const r = redondearEsquinas(rectangulo(0, 0, 100, 50), 10)
  assert.equal(r.nodos.length, 8)
  cerca(areaForma(r), 5000 - (4 - Math.PI) * 100, 1)
  // radio mayor que la mitad del lado: se limita
  const g = redondearEsquinas(rectangulo(0, 0, 20, 20), 50)
  cerca(areaForma(g), Math.PI * 100, 1)
})

test("transformar: ajustar caja, espejo y alinear", () => {
  const r = rectangulo(0, 0, 100, 50)
  const [g] = ajustarCaja([r], { ancho: 200 }, true)
  assert.deepEqual(cajaDe([g]), { x0: 0, y0: 0, x1: 200, y1: 100 })
  const m = espejo(r, "h", [0, 0])
  assert.deepEqual(cajaDe([m]), { x0: -100, y0: 0, x1: 0, y1: 50 })
  // espejo conserva el sentido (antihorario: área positiva)
  assert.ok(areaPts(aplanar(m)) > 0)
  const al = alinear([rectangulo(5, 5, 10, 10), rectangulo(40, 0, 10, 30)], "abajo", { x0: 0, y0: 0, x1: 100, y1: 100 })
  assert.equal(cajaDe([al[0]])!.y0, 0)
})

test("arreglos", () => {
  const r = rectangulo(0, 0, 10, 10)
  const fila = arregloLineal([r], 3, 20, 0)
  assert.equal(fila.length, 3)
  assert.equal(cajaDe(fila)!.x1, 70)
  assert.equal(new Set(fila.map((f) => f.id)).size, 3)
  const ronda = arregloCircular([rectangulo(40, -5, 10, 10)], 6, [0, 0])
  assert.equal(ronda.length, 5)
  const c = cajaDe([r, ...ronda.concat([rectangulo(40, -5, 10, 10)])])!
  cerca(c.x0, -50, 0.5)
})

test("nodos: insertar, suavizar, partir y unir", () => {
  const l = linea([
    [0, 0],
    [100, 0],
  ])
  const m = insertarNodo(l, 0, 0.5)
  assert.deepEqual(m.nodos[1].p, [50, 0])
  const c = circulo(0, 0, 10)
  const q = puntoMasCercano(c, [10.5, 0.2])
  const ins = insertarNodo(c, q.tramo, q.u)
  assert.equal(ins.nodos.length, 5)
  cerca(largo(ins), largo(c), 0.05) // partir una curva no cambia la forma
  const s = suavizarNodo(linea([[0, 0], [50, 50], [100, 0]]), 1)
  assert.ok(s.nodos[1].a && s.nodos[1].b)
  const abierto = partirEnNodo(rectangulo(0, 0, 10, 10), 0)
  assert.equal(abierto[0].cerrada, false)
  assert.equal(abierto[0].nodos.length, 5)
  const dos = partirEnNodo(linea([[0, 0], [10, 0], [20, 0]]), 1)
  assert.equal(dos.length, 2)
  const unidos = unirAbiertas([linea([[0, 0], [10, 0]]), linea([[10, 10], [10, 0]]), linea([[10, 10], [0, 0]])])
  assert.equal(unidos.length, 1)
  assert.equal(unidos[0].cerrada, true)
})

test("dibujo para el CAM: sólo capas que se maquinan", () => {
  const doc = documentoNuevo()
  doc.formas = [rectangulo(0, 0, 10, 10), { ...circulo(5, 5, 2), capa: "guia" }]
  const d = aDibujo(doc)
  assert.equal(d.trazos.length, 1)
  assert.equal(d.trazos[0].capa, "corte")
  assert.ok(documentoValido(JSON.parse(JSON.stringify(doc))))
  assert.equal(documentoValido({ version: 2 }), null)
})
