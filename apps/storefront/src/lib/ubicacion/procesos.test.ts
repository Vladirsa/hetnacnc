// Pruebas: en apps/storefront, `npx tsx --tsconfig tsconfig.json --test src/lib/ubicacion/*.test.ts`
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { TIPOS_MAQUINA } from "@/lib/hetna/talleres"
import { PROCESOS, procesosDeProducto, tallerHace } from "./procesos"

const producto = (title: string, extra: Record<string, unknown> = {}, cats: string[] = []) => ({
  title,
  metadata: extra,
  categories: cats.map((name) => ({ name, handle: name.toLowerCase() })),
})

test("procesos de lo que se fabrica", () => {
  assert.deepEqual(procesosDeProducto(producto("Celosía de MDF para muro")), ["corte_laser", "router"])
  assert.deepEqual(procesosDeProducto(producto("Celosía de acero para fachada")), ["corte_plasma", "corte_laser", "router"])
  assert.deepEqual(procesosDeProducto(producto("Celosía de lámina de acrílico")), ["corte_laser", "router"])
  assert.deepEqual(procesosDeProducto(producto("Pieza maquilada en aluminio", { tipo_producto: "a_medida" })), ["maquinado_metal", "router"])
  assert.deepEqual(procesosDeProducto(producto("Relieve 3D de la Virgen en madera")), ["router"])
  assert.deepEqual(procesosDeProducto(producto("Llavero impreso en 3D")), ["impresion_3d"])
  assert.deepEqual(procesosDeProducto(producto("Organizador de cables STL", { producto_digital: true })), ["impresion_3d"])
  // un relieve en STL es para router, no para imprimir
  assert.deepEqual(procesosDeProducto(producto("Relieve 3D STL para router CNC")), ["router"])
  assert.deepEqual(procesosDeProducto(producto("Escudo de armas", {}, ["Modelos STL para CNC"])), ["router"])
  assert.deepEqual(procesosDeProducto(producto("Maceta", { impresion_bajo_pedido: true })), ["impresion_3d"])
  assert.deepEqual(procesosDeProducto(producto("Lo que sea", { procesos: "torno, corte_laser, nada" })), ["torno", "corte_laser"])
})

test("sin talleres en lo que NO se fabrica (materiales, máquinas, consumibles, cursos)", () => {
  for (const t of [
    "Impresora 3D Creality Ender",
    "Filamento PLA 1kg negro",
    "Resina UV 1L",
    "Hoja de MDF 3mm 122x244",
    "Lámina de acrílico 3mm",
    "Máquina láser CO2 60W",
    "Router CNC 6090",
    "Aceite para máquina",
  ])
    assert.deepEqual(procesosDeProducto(producto(t)), [], t)
  assert.deepEqual(procesosDeProducto(producto("Fresa de corte ascendente", {}, ["Fresas"])), [])
  assert.deepEqual(procesosDeProducto(producto("Curso de CAM", { producto_servicio: true })), [])
})

test("el taller hace el proceso por sus servicios o por sus máquinas", () => {
  const t = (servicios: string[], tipos: string[]) => ({ perfil: { servicios, maquinas: tipos.map((tipo) => ({ nombre: "", tipo })) } }) as never
  assert.ok(tallerHace(t(["Corte láser"], []), ["corte_laser"]))
  assert.ok(tallerHace(t([], ["router"]), ["corte_laser", "router"]))
  assert.ok(!tallerHace(t(["Impresión 3D"], ["impresora_3d"]), ["corte_plasma"]))
})

test("los servicios y máquinas de PROCESOS existen en el panel del taller", () => {
  const panel = readFileSync(join(__dirname, "../../../../vendor/src/routes/perfil-taller/page.tsx"), "utf8")
  const bloque = panel.slice(panel.indexOf("const SERVICIOS = ["), panel.indexOf("]", panel.indexOf("const SERVICIOS = [")))
  const tipos = new Set(TIPOS_MAQUINA.map(([v]) => v))
  for (const [k, p] of Object.entries(PROCESOS)) {
    for (const s of p.servicios) assert.ok(bloque.includes(`"${s}"`), `${k}: el servicio "${s}" no está en el panel`)
    for (const m of p.maquinas) assert.ok(tipos.has(m), `${k}: la máquina "${m}" no está en TIPOS_MAQUINA`)
  }
})
