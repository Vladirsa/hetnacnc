// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/rebanado.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { hacerRebanado } from "./rebanado"

// Caja cerrada (12 triángulos) de x0..x1, y0..y1, z0..z1
function caja(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): number[] {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
  const caras = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
  return caras.flatMap((c) => c.flatMap((i) => v[i]))
}

// Banca ondulada: tira de cajas a lo largo de Y con la altura del asiento en onda
function bancaOndulada(): number[] {
  const out: number[] = []
  for (let i = 0; i < 40; i++) {
    const x0 = i * 30
    const alto = 380 + 80 * Math.sin((i / 40) * Math.PI * 2)
    out.push(...caja(x0, x0 + 30, 0, 450, 0, alto))
  }
  return out
}

const base = { eje: "y" as const, altura: 450, espesor: 15, hoja: { ancho: 2440, alto: 1220 }, barrenos: false, diametroBarreno: 4, numerar: true }

test("capas pegadas: igual que antes (altura / espesor)", () => {
  const r = hacerRebanado(caja(0, 100, 0, 100, 0, 60), { ...base, eje: "z", altura: 60, espesor: 6 })
  assert.equal(r.capas, 10)
  assert.equal(r.varillas, 0)
})

test("costillas separadas: cuántas caben con aire entre ellas", () => {
  // 450 mm, tabla de 15 y aire de 15: floor((450+15)/(30)) = 15 costillas
  const r = hacerRebanado(caja(0, 1200, 0, 450, 0, 400), { ...base, modo: "costillas", separacion: 15, varillas: 2, diametroVarilla: 8.5 })
  assert.equal(r.capas, 15)
  assert.equal(r.varillas, 2)
  assert.ok(r.avisos.some((a) => a.includes("varilla(s) roscada(s)")))
})

test("banca ondulada: varillas en la zona común de todas las costillas", () => {
  const r = hacerRebanado(bancaOndulada(), { ...base, modo: "costillas", separacion: 20, varillas: 3, diametroVarilla: 8.5 })
  assert.ok(r.capas > 5)
  assert.ok(r.varillas >= 2, `varillas: ${r.varillas}`)
  assert.ok(r.dibujo)
})

test("sin zona común: avisa en vez de poner varillas", () => {
  // Dos bloques que no se traslapan a lo largo del eje Y: ninguna costilla comparte zona con la otra
  const m = [...caja(0, 100, 0, 200, 0, 100), ...caja(300, 400, 200, 400, 0, 100)]
  const r = hacerRebanado(m, { ...base, altura: 400, modo: "costillas", separacion: 20, varillas: 2, diametroVarilla: 8.5 })
  assert.equal(r.varillas, 0)
  assert.ok(r.avisos.some((a) => a.includes("No hay un punto")))
})
