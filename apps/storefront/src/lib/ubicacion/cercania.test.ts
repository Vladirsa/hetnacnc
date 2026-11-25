// Pruebas: en apps/storefront, `npx tsx --tsconfig tsconfig.json --test src/lib/ubicacion/*.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { hayCerca, nivelCercania, normalizarEstado, ordenarPorCercania, sonVecinos } from "./cercania"
import { procesosDeProducto, tallerHace } from "./procesos"

test("normaliza los nombres del catálogo postal y las abreviaturas", () => {
  assert.equal(normalizarEstado("Michoacán de Ocampo"), "Michoacán")
  assert.equal(normalizarEstado("Veracruz de Ignacio de la Llave"), "Veracruz")
  assert.equal(normalizarEstado("México"), "Estado de México")
  assert.equal(normalizarEstado("CDMX"), "Ciudad de México")
  assert.equal(normalizarEstado("puebla"), "Puebla")
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
  assert.equal(nivelCercania({ cp: "72000", estado: "Puebla" }, cliente), 0)
  assert.equal(nivelCercania({ ciudad: "puebla", estado: "Puebla" }, cliente), 0)
  assert.equal(nivelCercania({ ciudad: "Tehuacán", estado: "Puebla" }, cliente), 1)
  assert.equal(nivelCercania({ ciudad: "Apizaco", estado: "Tlaxcala" }, cliente), 2)
  assert.equal(nivelCercania({ ciudad: "Mérida", estado: "Yucatán" }, cliente), 3)
  assert.equal(nivelCercania({ ciudad: "Apizaco" }, cliente), 4)
  assert.equal(nivelCercania({ estado: "Puebla" }, null), 4)
  // sólo estado (por IP): no hay municipio, sale "en tu estado"
  assert.equal(nivelCercania({ ciudad: "Puebla", estado: "Puebla" }, { estado: "Puebla" }), 1)
})

test("ordena por cercanía y luego por el desempate (destacado primero)", () => {
  const talleres = [
    { n: "lejos destacado", estado: "Sonora", destacado: true },
    { n: "vecino", estado: "Tlaxcala", destacado: false },
    { n: "estado", estado: "Puebla", destacado: false },
    { n: "estado destacado", estado: "Puebla", destacado: true },
    { n: "sin ubicación", destacado: false },
  ]
  const r = ordenarPorCercania(talleres, (t) => ({ estado: t.estado }), cliente, (a, b) => Number(b.destacado) - Number(a.destacado))
  assert.deepEqual(r.map((t) => t.n), ["estado destacado", "estado", "vecino", "lejos destacado", "sin ubicación"])
  assert.ok(hayCerca(r.map((t) => t.nivel)))
  // sin ubicación del cliente queda el orden del desempate
  const s = ordenarPorCercania(talleres, (t) => ({ estado: t.estado }), null, (a, b) => Number(b.destacado) - Number(a.destacado))
  assert.deepEqual(s.slice(0, 2).map((t) => t.n), ["lejos destacado", "estado destacado"])
  assert.ok(!hayCerca(s.map((t) => t.nivel)))
})

const producto = (title: string, extra: Record<string, unknown> = {}) => ({ title, metadata: { tipo_producto: "a_medida", ...extra }, categories: [] })

test("procesos según el producto", () => {
  assert.deepEqual(procesosDeProducto(producto("Celosía de MDF para muro")), ["corte_laser", "router"])
  assert.deepEqual(procesosDeProducto(producto("Celosía de acero para fachada")), ["corte_plasma", "corte_laser", "router"])
  assert.deepEqual(procesosDeProducto(producto("Pieza maquilada en aluminio")), ["maquinado_metal", "router"])
  assert.deepEqual(procesosDeProducto(producto("Relieve 3D de la Virgen en madera")), ["router"])
  assert.deepEqual(procesosDeProducto(producto("Maceta", { impresion_bajo_pedido: true })), ["impresion_3d"])
  assert.deepEqual(procesosDeProducto(producto("Lo que sea", { procesos: "torno, corte_laser, nada" })), ["torno", "corte_laser"])
  assert.deepEqual(procesosDeProducto({ title: "Curso de CAM", metadata: { producto_servicio: true } }), [])
})

test("el taller hace el proceso por sus servicios o por sus máquinas", () => {
  const t = (servicios: string[], tipos: string[]) => ({ perfil: { servicios, maquinas: tipos.map((tipo) => ({ nombre: "", tipo })) } }) as never
  assert.ok(tallerHace(t(["Corte láser"], []), ["corte_laser"]))
  assert.ok(tallerHace(t([], ["router"]), ["corte_laser", "router"]))
  assert.ok(!tallerHace(t(["Impresión 3D"], ["impresora_3d"]), ["corte_plasma"]))
})
