// Pruebas: en apps/storefront, `npx tsx --tsconfig tsconfig.json --test src/lib/ubicacion/*.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { conNivel, hayCerca, nivelCercania, normalizarEstado, sonVecinos, textoUbicacion, ubicacionDePerfil } from "./cercania"

test("normaliza los nombres del catálogo postal y las abreviaturas", () => {
  assert.equal(normalizarEstado("Michoacán de Ocampo"), "Michoacán")
  assert.equal(normalizarEstado("Veracruz de Ignacio de la Llave"), "Veracruz")
  assert.equal(normalizarEstado("México"), "Estado de México")
  assert.equal(normalizarEstado("CDMX"), "Ciudad de México")
  assert.equal(normalizarEstado("puebla"), "Puebla")
  assert.equal(normalizarEstado("Mexico City"), "Ciudad de México")
  assert.equal(normalizarEstado("State of Mexico"), "Estado de México")
  assert.equal(normalizarEstado(""), "")
})

test("estados vecinos (INEGI)", () => {
  assert.ok(sonVecinos("Puebla", "Tlaxcala"))
  assert.ok(sonVecinos("Ciudad de México", "Estado de México"))
  assert.ok(!sonVecinos("Ciudad de México", "Hidalgo"))
  assert.ok(!sonVecinos("Yucatán", "Jalisco"))
})

const cliente = { cp: "72000", municipio: "Puebla", estado: "Puebla" }

test("niveles: municipio, estado, vecino, lejos y sin dato", () => {
  assert.equal(nivelCercania({ ciudad: "puebla", estado: "Puebla" }, cliente), 0)
  assert.equal(nivelCercania({ ciudad: "Tehuacán", estado: "Puebla" }, cliente), 1)
  assert.equal(nivelCercania({ ciudad: "Apizaco", estado: "Tlaxcala" }, cliente), 2)
  assert.equal(nivelCercania({ ciudad: "Mérida", estado: "Yucatán" }, cliente), 3)
  assert.equal(nivelCercania({ ciudad: "Apizaco" }, cliente), 4)
  assert.equal(nivelCercania({ estado: "Puebla" }, null), 4)
  // sólo estado (por IP): no hay municipio, sale "en tu estado"
  assert.equal(nivelCercania({ ciudad: "Puebla", estado: "Puebla" }, { estado: "Puebla" }), 1)
})

test("conNivel calcula el nivel una vez; cada lista arma su orden (destacados primero)", () => {
  const talleres = [
    { n: "lejos destacado", estado: "Sonora", destacado: true },
    { n: "vecino", estado: "Tlaxcala", destacado: false },
    { n: "estado", estado: "Puebla", destacado: false },
    { n: "sin ubicación", destacado: false },
  ]
  const r = conNivel(talleres, (t) => ({ estado: t.estado }), cliente)
    .sort((a, b) => Number(b.item.destacado) - Number(a.item.destacado) || a.nivel - b.nivel || a.i - b.i)
  assert.deepEqual(r.map((x) => x.item.n), ["lejos destacado", "estado", "vecino", "sin ubicación"])
  assert.ok(hayCerca(r.map((x) => x.nivel)))
  assert.ok(!hayCerca(conNivel(talleres, (t) => ({ estado: t.estado }), null).map((x) => x.nivel)))
})

test("ubicación del perfil: sólo ciudad y estado (nunca el CP)", () => {
  assert.deepEqual(ubicacionDePerfil({ perfil: { ciudad: " Apizaco ", estado: "Tlaxcala", cp: "90300" } }), { ciudad: "Apizaco", estado: "Tlaxcala" })
  assert.deepEqual(ubicacionDePerfil(null), { ciudad: undefined, estado: undefined })
  assert.equal(textoUbicacion({ ciudad: "Apizaco", estado: "Tlaxcala" }), "Apizaco, Tlaxcala")
  assert.equal(textoUbicacion({ municipio: "Puebla", estado: "Puebla" }), "Puebla, Puebla")
})
