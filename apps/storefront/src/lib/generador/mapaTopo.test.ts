// Pruebas: `npx tsx --tsconfig tsconfig.json --test src/lib/generador/mapaTopo.test.ts`
import assert from "node:assert/strict"
import { test } from "node:test"

import { cajaDe } from "./contornos"
import { OPCIONES_MAPA_3D, alturaTerrarium, mallaMapa, piezasMapa, planMosaicos } from "./mapaTopo"
import { volumenMalla } from "./vectores"

test("Terrarium: 32768 de base", () => {
  assert.equal(alturaTerrarium(128, 0, 0), 0)
  assert.equal(alturaTerrarium(128, 100, 128), 100.5)
})

test("plan de mosaicos: ~300 px y pocos mosaicos", () => {
  const p = planMosaicos(19.03, -97.27, 20)
  assert.ok(p.recorte.x1 - p.recorte.x0 >= 300)
  assert.ok(p.tiles.length >= 1 && p.tiles.length <= 9)
  assert.ok(p.tiles.every((t) => t.url.startsWith("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/")))
})

test("un cerro: una pieza por capa, cada vez más chica", () => {
  const w = 80, h = 60, e = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) e[y * w + x] = 1000 * Math.exp(-((x - 40) ** 2 + (y - 30) ** 2) / 300)
  const r = piezasMapa(e, w, h, { capas: 5, ancho: 200, hoja: { ancho: 600, alto: 400 }, invertir: false })
  assert.deepEqual(r.errores, [])
  const cortes = r.dibujo.trazos.filter((t) => t.capa === "corte")
  assert.equal(cortes.length, 6, "base + 5 capas de un solo cerro")
  const area = (p: number[][]) => Math.abs(p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0) / 2)
  const areas = cortes.map((t) => area(t.pts))
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] < areas[i - 1], "cada capa más chica")
  assert.equal(r.dibujo.trazos.filter((t) => t.capa === "marcar").length, 5)
  assert.match(piezasMapa(new Float32Array(w * h), w, h, { capas: 5, ancho: 200, hoja: { ancho: 600, alto: 400 }, invertir: false }).errores[0], /plano/)
})

const W_ = 80, H_ = 60
const cerro = (cx: number, cy: number, s: number) => {
  const e = new Float32Array(W_ * H_)
  for (let y = 0; y < H_; y++) for (let x = 0; x < W_; x++) e[y * W_ + x] = 1000 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s)
  return e
}
const OPC = { capas: 6, ancho: 200, hoja: { ancho: 600, alto: 400 }, invertir: false }
const ALTO = (OPC.ancho * H_) / W_ // mm de la base

test("cerro en la orilla: ninguna capa se sale de la base", () => {
  const r = piezasMapa(cerro(75, 30, 600), W_, H_, OPC)
  assert.equal(r.noCaben, 0)
  for (const t of r.dibujo.trazos.filter((t) => t.capa === "corte")) {
    const b = cajaDe([t.pts])
    assert.ok(b.x1 - b.x0 <= OPC.ancho + 1e-6 && b.y1 - b.y0 <= ALTO + 1e-6, `pieza de ${b.x1 - b.x0} × ${b.y1 - b.y0}`)
  }
})

test("el norte queda arriba: la guía de un cerro en la fila de arriba cae arriba en la base", () => {
  const r = piezasMapa(cerro(40, 5, 100), W_, H_, { ...OPC, hoja: { ancho: 2000, alto: 2000 } })
  // la base es el primer grupo: su rectángulo y la guía de la capa 1
  const base = cajaDe([r.dibujo.trazos.find((t) => t.capa === "corte")!.pts])
  const guia = cajaDe([r.dibujo.trazos.find((t) => t.capa === "marcar")!.pts])
  assert.ok(guia.y1 <= base.y1 + 1e-6 && guia.y0 >= base.y0 - 1e-6, "la guía dentro de la base")
  assert.ok(guia.y1 - base.y0 > ALTO * 0.9, `la guía toca la orilla de arriba (${guia.y1 - base.y0})`)
  assert.ok(guia.y0 - base.y0 > ALTO * 0.5, `y no baja de la mitad (${guia.y0 - base.y0})`)
})

test("mapa para imprimir: capas apiladas, volumen real y dos colores", () => {
  const r = mallaMapa(cerro(40, 30, 300), W_, H_, { capas: 6, ancho: 120, invertir: false, ...OPCIONES_MAPA_3D })
  assert.deepEqual(r.errores, [])
  assert.equal(r.malla.partes?.length, 2)
  assert.equal(r.malla.partes!.reduce((s, p) => s + p.triangulos, 0) * 9, r.malla.tris.length)
  let zmax = -Infinity, zmin = Infinity
  for (let i = 2; i < r.malla.tris.length; i += 3) (zmax = Math.max(zmax, r.malla.tris[i])), (zmin = Math.min(zmin, r.malla.tris[i]))
  assert.ok(Math.abs(zmin) < 1e-6 && Math.abs(zmax - r.alto) < 1e-6, `de ${zmin} a ${zmax}`)
  assert.ok(Math.abs(r.alto - (OPCIONES_MAPA_3D.base + 6 * OPCIONES_MAPA_3D.grosorCapa)) < 1e-9)
  // volumen: la base llena más cada capa en su grosor (menos que un bloque macizo de la altura total)
  const cm3 = (mm3: number) => mm3 / 1000
  const v = volumenMalla(r.malla.tris) // cm³
  assert.ok(v > cm3(120 * 90 * OPCIONES_MAPA_3D.base) && v < cm3(120 * 90 * r.alto) * 0.6, `volumen ${v} cm³`)
})

test("mapas del catálogo: sus alturas guardadas, 2 colores y liga que carga el lugar", async () => {
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { CATALOGO_IMPRESION, urlHerramienta } = await import("../impresion/catalogo-disenos")
  const mapas = CATALOGO_IMPRESION.filter((d) => d.pieza === "mapa")
  assert.ok(mapas.length >= 4)
  for (const d of mapas) {
    const a = JSON.parse(readFileSync(join(__dirname, "../../../../../docs/impresion-bajo-pedido/alturas", `${d.handle}.json`), "utf8"))
    assert.equal(a.alturas.length, a.w * a.h, d.handle)
    const r = mallaMapa(Float32Array.from(a.alturas), a.w, a.h, { capas: d.mapa!.capas, ancho: d.mapa!.ancho, invertir: false, ...OPCIONES_MAPA_3D })
    assert.equal(r.malla.partes?.length, 2, d.handle)
    const u = new URL(urlHerramienta(d), "https://x")
    assert.equal(u.pathname, "/disenar/mapa-topografico")
    assert.equal(Number(u.searchParams.get("lat")), d.mapa!.lat)
  }
})
