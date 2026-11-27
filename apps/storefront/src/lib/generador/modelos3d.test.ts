// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/modelos3d.test.ts`
// Arma cada modelo con sus medidas de fábrica (y los nuevos también en sus extremos)
// y revisa que el sólido salga cerrado, con volumen y apoyado en la cama.
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { test } from "node:test"

import { MODELOS, construirMalla, valoresIniciales } from "./modelos3d"
import { volumenMalla } from "./vectores"

let wasm: any = null
async function manifold() {
  if (!wasm) {
    const { default: Module } = await import("manifold-3d")
    wasm = await Module({ locateFile: () => resolve(__dirname, "../../../node_modules/manifold-3d/manifold.wasm") })
    wasm.setup()
  }
  return wasm
}

async function revisar(id: string, valores: Record<string, number>) {
  const m = MODELOS.find((x) => x.id === id)!
  const r = await construirMalla(m, valores, await manifold())
  assert.ok(r.tris.length >= 9 * 12, `${id}: sin malla`)
  assert.ok(r.cerrado, `${id}: el sólido no cierra`)
  assert.ok(volumenMalla(r.tris) > 0, `${id}: volumen`)
  let zmin = Infinity
  for (let i = 2; i < r.tris.length; i += 3) zmin = Math.min(zmin, r.tris[i])
  assert.ok(Math.abs(zmin) < 1e-6, `${id}: no apoya en la cama`)
  return r
}

test("todos los modelos arman con sus medidas de fábrica", async () => {
  for (const m of MODELOS) await revisar(m.id, valoresIniciales(m))
})

test("Gridfinity: la caja mide 42·n − 0.5 y la base 42·n", async () => {
  const caja = await revisar("gridfinity-caja", { x: 3, y: 2, alto: 6, divisiones: 3, pared: 1.2, imanes: 1 })
  assert.ok(Math.abs(caja.medidas[0] - (3 * 42 - 0.5)) < 0.05 && Math.abs(caja.medidas[1] - (2 * 42 - 0.5)) < 0.05)
  assert.ok(Math.abs(caja.medidas[2] - 42) < 0.05, "6 unidades de 7 mm")
  const base = await revisar("gridfinity-base", { x: 5, y: 4 })
  assert.ok(Math.abs(base.medidas[0] - 210) < 0.05 && Math.abs(base.medidas[1] - 168) < 0.05)
})

test("florero, pantalla y cadena en sus extremos", async () => {
  await revisar("florero-espiral", { diametro: 30, alto: 300, boca: 200, ondas: 24, profundidad: 20, giro: -360 })
  await revisar("florero-espiral", { diametro: 200, alto: 40, boca: 30, ondas: 0, profundidad: 0, giro: 0 })
  await revisar("pantalla-lampara", { abajo: 250, arriba: 60, alto: 250, ondas: 30, profundidad: 20, giro: 360, pared: 0.8, socket: 20 })
  await revisar("cadena-portacables", { ancho: 60, alto: 40, eslabones: 12 })
  await revisar("cadena-portacables", { ancho: 6, alto: 6, eslabones: 1 })
})
