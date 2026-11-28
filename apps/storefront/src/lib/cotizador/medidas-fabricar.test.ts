// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/cotizador/medidas-fabricar.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { medidasEnUnidad, medidasTrasCambio } from "./medidas-fabricar"

const base = { ancho: "200", largo: "100", alto: "0" } // mm

test("libres: borrar y escribir 10 deja 10 y no toca las demás", () => {
  let m = { ancho: "20", largo: "10", alto: "" }
  m = medidasTrasCambio(m, "ancho", "", { proporcion: false, base, unidad: "cm" })
  assert.equal(m.ancho, "")
  m = medidasTrasCambio(m, "ancho", "1", { proporcion: false, base, unidad: "cm" })
  m = medidasTrasCambio(m, "ancho", "10", { proporcion: false, base, unidad: "cm" })
  m = medidasTrasCambio(m, "largo", "35", { proporcion: false, base, unidad: "cm" })
  m = medidasTrasCambio(m, "alto", "2", { proporcion: false, base, unidad: "cm" })
  assert.deepEqual(m, { ancho: "10", largo: "35", alto: "2" })
})

test("en proporción: las otras siguen a la que cambió; vacío no mueve nada", () => {
  const m = medidasTrasCambio({ ancho: "20", largo: "10", alto: "" }, "ancho", "40", { proporcion: true, base, unidad: "cm" })
  assert.deepEqual(m, { ancho: "40", largo: "20", alto: "" })
  assert.deepEqual(medidasTrasCambio(m, "ancho", "", { proporcion: true, base, unidad: "cm" }), { ancho: "", largo: "20", alto: "" })
})

test("cm ↔ mm conserva lo escrito", () => {
  assert.deepEqual(medidasEnUnidad({ ancho: "10", largo: "2.5", alto: "" }, "cm", "mm"), { ancho: "100", largo: "25", alto: "" })
  assert.deepEqual(medidasEnUnidad({ ancho: "100", largo: "25", alto: "" }, "mm", "cm"), { ancho: "10", largo: "2.5", alto: "" })
})
