// Pruebas de lo que "Fabrícalo" toma de la ficha: medidas del nombre y material
import assert from "node:assert/strict"
import { test } from "node:test"

import { indiceMaterial, leerMedidas } from "@/components/hetna/fichas/descarga/FabricarDiseno"
import { materialesPara } from "@/lib/cotizador/estimador"
import { medidasEnTexto } from "@/lib/hetna/tipo-producto"

test("medidas escritas en el nombre", () => {
  assert.equal(medidasEnTexto("Celosía hexagonal 600x600 mm en DXF"), "600 × 600 mm")
  assert.equal(medidasEnTexto("Tabla de pino con silueta de pino, 25x15 cm, para regalo"), "250 × 150 mm")
  assert.equal(medidasEnTexto("Caja 30 × 20 × 2,5 cm"), "300 × 200 × 25 mm")
  assert.equal(medidasEnTexto("Celosía de MDF"), "")
  assert.deepEqual(leerMedidas(medidasEnTexto("Celosía hexagonal 600x600 mm")), { largo: 600, ancho: 600, alto: 0 })
})

test("material del producto en la lista de la máquina", () => {
  const router = materialesPara("router")
  const nombre = (txt: string, m = router) => m[indiceMaterial(m, txt)].nombre
  assert.equal(nombre("Tabla de pino con silueta de pino, 25x15 cm"), "Pino 19 mm (tabla)")
  assert.equal(nombre("MDF 9 mm Celosía 600x600 mm"), "MDF 9 mm")
  assert.equal(nombre("Celosía hexagonal 600x600 mm"), router[0].nombre) // "600 mm" no es grosor ni material
  assert.equal(nombre("Letrero de acrílico 6 mm", materialesPara("laser_co2")), "Acrílico 6 mm")
  assert.equal(nombre("Placa de aluminio"), "Aluminio 3 mm")
})
