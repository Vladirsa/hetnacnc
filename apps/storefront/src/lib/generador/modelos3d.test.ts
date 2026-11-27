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

test("modelos nuevos (electrónica, mecánica, carpintería, eventos) en sus extremos", async () => {
  // Raspberry Pi 4 con ventana del lado derecho; caja mínima sin ventana
  await revisar("caja-electronica-tapa", { largo: 85, ancho: 56, altoInt: 22, origenX: 3.5, origenY: 3.5, sepX: 58, sepY: 49, barreno: 2.2, ventana: 3, posVentana: 28, anchoVentana: 52, altoVentana: 16, pared: 2 })
  await revisar("caja-electronica-tapa", { largo: 20, ancho: 15, altoInt: 8, origenX: 1, origenY: 1, sepX: 5, sepY: 5, barreno: 1.5, ventana: 0, posVentana: 5, anchoVentana: 5, altoVentana: 3, pared: 1.2 })
  await revisar("polea-gt2", { dientes: 12, eje: 3, banda: 4, pestanas: 0, cubo: 0 })
  const g = await revisar("polea-gt2", { dientes: 20, eje: 5, banda: 6, pestanas: 1, cubo: 7 })
  // 20 dientes GT2: diámetro de paso 12.73 mm, exterior 12.22 mm; pestaña de 16 mm (igual que el cubo)
  assert.ok(Math.abs(g.medidas[0] - 16) < 0.1, "diámetro de la pestaña")
  await revisar("polea-gt2", { dientes: 80, eje: 14, banda: 15, pestanas: 1, cubo: 20 })
  await revisar("acoplador-ejes", { eje1: 2, eje2: 20, largo: 12, diametro: 10 })
  await revisar("plantilla-bisagra-cazoleta", { copa: 40, distancia: 30, separacion: 60, desfase: 15, piloto: 5, grosor: 15 })
  await revisar("guia-jaladeras", { separacion: 32, distancia: 10, broca: 10, grosor: 4 })
  await revisar("guia-jaladeras", { separacion: 320, distancia: 120, broca: 3, grosor: 12 })
  await revisar("escuadra-sujecion", { lado: 50, alto: 60, grosor: 15 })
  await revisar("base-trofeo", { ancho: 60, fondo: 40, alto: 12, placa: 10, anchoPlaca: 240, inclinacion: 25 })
  await revisar("medalla", { diametro: 30, grosor: 2.5, orilla: 10, hueco: 3, liston: 40 })
  await revisar("gridfinity-porta-brocas", { x: 1, y: 1, alto: 3, diametro: 20, separacion: 4, profundidad: 70 })
  const pb = await revisar("gridfinity-porta-brocas", { x: 3, y: 2, alto: 6, diametro: 3, separacion: 8, profundidad: 20 })
  assert.ok(Math.abs(pb.medidas[0] - (3 * 42 - 0.5)) < 0.05, "encaja en la rejilla de 42 mm")
})
