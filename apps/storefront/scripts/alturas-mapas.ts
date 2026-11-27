// Baja una vez las alturas de los mapas topográficos del catálogo de impresión
// (pieza "mapa" en src/lib/impresion/catalogo-disenos.ts) y las guarda en
// docs/impresion-bajo-pedido/alturas/<handle>.json, para que el generador del
// catálogo y sus pruebas no dependan de la red. Mismo recorte que la página
// (lib/generador/mapaTopo.ts → planMosaicos), en una cuadrícula de LADO px.
//
// Uso (en apps/storefront): npx tsx scripts/alturas-mapas.ts
// Alturas: Mapzen Terrain Tiles en AWS (datos SRTM/NASA y otros, uso libre con crédito).
import { mkdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import sharp from "sharp"

import { alturaTerrarium, planMosaicos } from "@/lib/generador/mapaTopo"
import { CATALOGO_IMPRESION } from "@/lib/impresion/catalogo-disenos"

const DIR = resolve(__dirname, "../../../docs/impresion-bajo-pedido/alturas")
const LADO = 120 // 1 px ≈ 1 mm en un mapa de 120 mm

async function alturas(lat: number, lon: number, km: number) {
  const p = planMosaicos(lat, lon, km)
  const cols = Math.max(...p.tiles.map((t) => t.x)) - p.tx0 + 1, filas = Math.max(...p.tiles.map((t) => t.y)) - p.ty0 + 1
  const W = cols * 256
  const grande = new Float32Array(W * filas * 256)
  for (const t of p.tiles) {
    const r = await fetch(t.url)
    if (!r.ok) throw new Error(`${t.url}: ${r.status}`)
    const { data } = await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const o = (y * 256 + x) * 4
        grande[((t.y - p.ty0) * 256 + y) * W + (t.x - p.tx0) * 256 + x] = alturaTerrarium(data[o], data[o + 1], data[o + 2])
      }
  }
  const rx = Math.floor(p.recorte.x0 - p.tx0 * 256), ry = Math.floor(p.recorte.y0 - p.ty0 * 256)
  const rw = Math.ceil(p.recorte.x1 - p.recorte.x0), rh = Math.ceil(p.recorte.y1 - p.recorte.y0)
  const k = Math.max(rw, rh) / LADO
  const w = Math.round(rw / k), h = Math.round(rh / k)
  const alt: number[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) alt.push(Math.round(grande[(ry + Math.min(rh - 1, Math.floor(y * k))) * W + rx + Math.min(rw - 1, Math.floor(x * k))]))
  return { w, h, alturas: alt }
}

async function main() {
  mkdirSync(DIR, { recursive: true })
  for (const d of CATALOGO_IMPRESION) {
    if (d.pieza !== "mapa" || !d.mapa) continue
    const a = await alturas(d.mapa.lat, d.mapa.lon, d.mapa.km)
    writeFileSync(join(DIR, `${d.handle}.json`), JSON.stringify({ lugar: d.mapa.lugar, lat: d.mapa.lat, lon: d.mapa.lon, km: d.mapa.km, fuente: "Mapzen Terrain Tiles (AWS)", ...a }) + "\n")
    console.log(`${d.handle}: ${a.w} × ${a.h}, de ${Math.min(...a.alturas)} a ${Math.max(...a.alturas)} m`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
