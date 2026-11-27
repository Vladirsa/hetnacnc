// Baja una vez las alturas de los mapas topográficos del catálogo de impresión
// (pieza "mapa" en src/lib/impresion/catalogo-disenos.ts) y las guarda en
// docs/impresion-bajo-pedido/alturas/<handle>.json, para que el generador del
// catálogo y sus pruebas no dependan de la red. Mismo recorte que la página
// (lib/generador/mapaTopo.ts → planMosaicos y rejillaAlturas), así "Modificar" da la pieza de la foto.
//
// Uso (en apps/storefront): npx tsx scripts/alturas-mapas.ts
// Alturas: Mapzen Terrain Tiles en AWS (datos SRTM/NASA y otros, uso libre con crédito).
import { mkdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import sharp from "sharp"

import { planMosaicos, rejillaAlturas } from "@/lib/generador/mapaTopo"
import { CATALOGO_IMPRESION } from "@/lib/impresion/catalogo-disenos"

const DIR = resolve(__dirname, "../../../docs/impresion-bajo-pedido/alturas")

/** Baja los mosaicos y arma la misma cuadrícula que la página (rejillaAlturas, LADO_ALTURAS). */
async function alturas(lat: number, lon: number, km: number) {
  const p = planMosaicos(lat, lon, km)
  const pixeles = await Promise.all(
    p.tiles.map(async (t) => {
      const r = await fetch(t.url)
      if (!r.ok) throw new Error(`${t.url}: ${r.status}`)
      return (await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data
    }),
  )
  const g = rejillaAlturas(p, pixeles)
  return { w: g.w, h: g.h, alturas: Array.from(g.alt) }
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
