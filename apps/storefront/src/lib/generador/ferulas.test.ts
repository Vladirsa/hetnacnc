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

test("férula con forma: dos mitades curvas que cierran alrededor del brazo", async () => {
  const { hacerFerula3D, subdividir, MEDIDAS_INICIALES } = await import("./ferulas")
  const m = MEDIDAS_INICIALES.antebrazo
  const r = hacerFerula3D({ tipo: "antebrazo", lado: "derecho", ...m, holgura: 6, grosor: 3, ventilacion: "hexagonos", puente: 4 })
  assert.deepEqual(r.errores, [])
  assert.equal(r.malla.partes?.length, 2)
  // por dentro, cada punto queda a la distancia del radio de su medida (no plana)
  const R = (m.circunferencias[0] + 6) / (2 * Math.PI)
  let dentro = 0, total = 0
  const t = r.malla.tris
  for (let i = 0; i < t.length; i += 3) {
    if (t[i + 1] > 5) continue // sólo cerca del codo (y ≈ 0)
    const d = Math.hypot(t[i], t[i + 2] - r.diametro / 2)
    total++
    if (d > R - 0.5 && d < R + 3.5) dentro++
  }
  assert.ok(total > 50 && dentro / total > 0.95, `${dentro}/${total} puntos sobre el cilindro`)
  // las dos mitades: una arriba y otra abajo del eje
  const zA = t.slice(0, r.malla.partes![0].triangulos * 9).filter((_, i) => i % 3 === 2)
  const zB = t.slice(r.malla.partes![0].triangulos * 9).filter((_, i) => i % 3 === 2)
  const minA = zA.reduce((a, b) => Math.min(a, b), Infinity), maxB = zB.reduce((a, b) => Math.max(a, b), -Infinity)
  assert.ok(minA > r.diametro / 2 - 5 && maxB < r.diametro / 2 + 5, `${minA} ${maxB}`)
  // las dos mitades con las caras hacia afuera: volumen con signo positivo en cada una
  const vol = (tt: number[]) => { let v = 0; for (let i = 0; i < tt.length; i += 9) v += (tt[i] * (tt[i + 4] * tt[i + 8] - tt[i + 5] * tt[i + 7]) - tt[i + 1] * (tt[i + 3] * tt[i + 8] - tt[i + 5] * tt[i + 6]) + tt[i + 2] * (tt[i + 3] * tt[i + 7] - tt[i + 4] * tt[i + 6])) / 6; return v }
  const nA = r.malla.partes![0].triangulos * 9
  assert.ok(vol(t.slice(0, nA)) > 1000 && vol(t.slice(nA)) > 1000, `volúmenes ${vol(t.slice(0, nA))} y ${vol(t.slice(nA))}`)
  // subdividir no cambia el área
  const area = (tt: number[]) => { let a = 0; for (let i = 0; i < tt.length; i += 9) { const u = [tt[i + 3] - tt[i], tt[i + 4] - tt[i + 1], tt[i + 5] - tt[i + 2]], v = [tt[i + 6] - tt[i], tt[i + 7] - tt[i + 1], tt[i + 8] - tt[i + 2]]; a += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2 } return a }
  const tri = [0, 0, 0, 10, 0, 0, 0, 10, 0]
  assert.ok(Math.abs(area(subdividir(tri, 2)) - area(tri)) < 1e-9)
})
