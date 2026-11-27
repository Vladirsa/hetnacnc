// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/ferulas.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { MEDIDAS_INICIALES, anchoEn, hacerFerula, type OpcionesFerula, type TipoFerula } from "./ferulas"
import { volumenMalla } from "./vectores"

const base = (tipo: TipoFerula, extra: Partial<OpcionesFerula> = {}): OpcionesFerula => {
  const m = MEDIDAS_INICIALES[tipo]
  return { tipo, lado: "derecho", circunferencias: m.circunferencias, largos: m.largos, cobertura: m.cobertura, holgura: 6, grosor: 3, margen: m.margen, ventilacion: "hexagonos", hueco: m.hueco, puente: 4, correas: m.correas, anchoCorrea: m.anchoCorrea, ...extra }
}

test("el ancho se interpola entre las estaciones", () => {
  const e: [number, number][] = [[0, 100], [100, 60], [150, 80]]
  assert.equal(anchoEn(0, e), 100)
  assert.equal(anchoEn(50, e), 80)
  assert.equal(anchoEn(125, e), 70)
  assert.equal(anchoEn(999, e), 80)
})

for (const tipo of ["antebrazo", "dedo", "pata"] as TipoFerula[]) {
  test(`${tipo}: sale una malla cerrada con el ancho y el largo esperados`, () => {
    const o = base(tipo)
    const r = hacerFerula(o)
    assert.deepEqual(r.errores, [])
    assert.ok(r.malla.tris.length > 0)
    assert.equal(r.malla.tris.length % 9, 0)
    assert.equal(r.largo, o.largos.reduce((a, b) => a + b, 0))
    const esperado = (Math.max(...o.circunferencias) + o.holgura) * o.cobertura
    assert.ok(Math.abs(r.ancho - esperado) < 0.01)
    assert.ok(r.huecos > 0, "tiene ventilación")
    assert.equal(r.correas, o.correas)
    // volumen positivo y menor que la placa sin huecos
    const v = Math.abs(volumenMalla(r.malla.tris))
    assert.ok(v > 0 && v < r.largo * r.ancho * o.grosor)
  })
}

test("los huecos bajan el volumen y sin ventilación no hay huecos", () => {
  const con = hacerFerula(base("antebrazo"))
  const sin = hacerFerula(base("antebrazo", { ventilacion: "ninguna" }))
  assert.equal(sin.huecos, 0)
  assert.ok(Math.abs(volumenMalla(sin.malla.tris)) > Math.abs(volumenMalla(con.malla.tris)))
})

test("el hueco del pulgar cambia de lado", () => {
  const xs = (lado: "derecho" | "izquierdo") => {
    const r = hacerFerula(base("antebrazo", { lado, ventilacion: "ninguna", correas: 0 }))
    return r.dibujo.trazos[0].pts
  }
  // a la altura del pulgar, el borde del lado elegido se mete hacia dentro
  const o = base("antebrazo")
  const yPulgar = o.largos[0] + 31
  const borde = (pts: [number, number][], signo: number) => Math.max(...pts.filter(([, y]) => Math.abs(y - yPulgar) < 2).map(([x]) => signo * x))
  const der = xs("derecho"), izq = xs("izquierdo")
  assert.ok(borde(der, 1) < borde(der, -1) - 5, "derecho: el borde derecho tiene la muesca")
  assert.ok(borde(izq, -1) < borde(izq, 1) - 5, "izquierdo: el borde izquierdo tiene la muesca")
})

test("medidas fuera de rango dan error en vez de una pieza rara", () => {
  assert.ok(hacerFerula(base("dedo", { circunferencias: [10, 5] })).errores.length)
  assert.ok(hacerFerula(base("pata", { largos: [900] })).errores.length)
  assert.ok(hacerFerula(base("antebrazo", { cobertura: 1 })).errores.length)
  assert.ok(hacerFerula(base("antebrazo", { grosor: 10 })).errores.length)
})

test("avisa si la pieza no cabe en una cama común", () => {
  const r = hacerFerula(base("antebrazo", { largos: [260, 80] }))
  assert.ok(r.avisos.some((a) => /cama/.test(a)))
})
