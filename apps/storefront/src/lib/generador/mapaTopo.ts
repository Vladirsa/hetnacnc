// Mapa topográfico por capas (2D Studio · Decoración): de las alturas de un
// lugar real salen las piezas para cortar en MDF o acrílico y apilar. Cada capa
// es la tierra que queda arriba de su altura; lleva grabada la silueta de la
// capa de encima para pegarlas en su lugar.
//
// Las alturas vienen de los mosaicos públicos "Terrarium" (AWS Terrain Tiles,
// datos SRTM y otros, libres): el navegador baja las imágenes y las decodifica
// (altura = R·256 + G + B/256 − 32768). Este archivo es la parte pura
// (alturas → piezas) y la cuenta de mosaicos; la descarga está en la pantalla.
import { acomodarEnHojas } from "@/lib/generador/geo2d"
import { aplanar } from "@/lib/generador/llaveros"
import { curvasDeMascara } from "@/lib/generador/trazado"
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

export const MOSAICOS = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"
export const CREDITO = "Alturas: Mapzen Terrain Tiles (AWS), datos SRTM/NASA y otros; uso libre."

/** Lugares de México para empezar (lat, lon, ancho en km). */
export const LUGARES: { nombre: string; lat: number; lon: number; km: number }[] = [
  { nombre: "Pico de Orizaba", lat: 19.03, lon: -97.27, km: 20 },
  { nombre: "Popocatépetl e Iztaccíhuatl", lat: 19.1, lon: -98.65, km: 40 },
  { nombre: "Nevado de Toluca", lat: 19.11, lon: -99.76, km: 14 },
  { nombre: "Cañón del Sumidero", lat: 16.84, lon: -93.08, km: 16 },
  { nombre: "Barranca del Cobre", lat: 27.53, lon: -107.75, km: 40 },
  { nombre: "Cerro de la Silla (Monterrey)", lat: 25.63, lon: -100.23, km: 14 },
  { nombre: "Volcán de Colima", lat: 19.51, lon: -103.62, km: 20 },
  { nombre: "Valle de México", lat: 19.43, lon: -99.13, km: 80 },
]

// ── mosaicos ───────────────────────────────────────────────────────────────
const lonAX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z
const latAY = (lat: number, z: number) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z

/** Mosaicos que cubren un cuadro de `km` de ancho centrado en (lat, lon), con unos 300 px de lado. */
export function planMosaicos(lat: number, lon: number, km: number) {
  const metrosPorGrado = 111320
  const dLat = km * 1000 / 2 / metrosPorGrado
  const dLon = dLat / Math.cos((lat * Math.PI) / 180)
  // zoom: que el cuadro mida ~300 px (256 px por mosaico)
  let z = 1
  for (; z < 14; z++) if ((lonAX(lon + dLon, z) - lonAX(lon - dLon, z)) * 256 >= 300) break
  const x0 = lonAX(lon - dLon, z), x1 = lonAX(lon + dLon, z)
  const y0 = latAY(lat + dLat, z), y1 = latAY(lat - dLat, z) // y crece hacia el sur
  const tiles: { x: number; y: number; url: string }[] = []
  for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) tiles.push({ x: tx, y: ty, url: `${MOSAICOS}/${z}/${tx}/${ty}.png` })
  return { z, tiles, recorte: { x0: x0 * 256, y0: y0 * 256, x1: x1 * 256, y1: y1 * 256 }, tx0: Math.floor(x0), ty0: Math.floor(y0) }
}

/** Píxeles RGBA de Terrarium → metros. */
export const alturaTerrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768

// ── alturas → piezas ───────────────────────────────────────────────────────
export type OpcionesMapa = {
  capas: number // cuántas capas (sin contar la base)
  ancho: number // mm de la pieza terminada (el lado largo)
  hoja: { ancho: number; alto: number } // material para acomodar las piezas
  invertir: boolean // profundidad (lagos, mar): la capa es lo que queda abajo
}

export type ResultadoMapa = { dibujo: Dibujo; hojas: number; noCaben: number; niveles: number[]; avisos: string[]; errores: string[] }

/** Suaviza la cuadrícula (caja 3×3) para que los contornos no salgan dentados. */
function suavizar(e: Float32Array, w: number, h: number): Float32Array {
  const s = new Float32Array(e.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let t = 0, n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) (t += e[yy * w + xx]), n++
        }
      s[y * w + x] = t / n
    }
  return s
}

export function piezasMapa(alturas: Float32Array, w: number, h: number, o: OpcionesMapa): ResultadoMapa {
  const vacio = (e: string): ResultadoMapa => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, hojas: 0, noCaben: 0, niveles: [], avisos: [], errores: [e] })
  if (w < 8 || h < 8 || alturas.length !== w * h) return vacio("No hay alturas para ese lugar.")
  const e = suavizar(alturas, w, h)
  let min = Infinity, max = -Infinity
  for (const v of e) (min = Math.min(min, v)), (max = Math.max(max, v))
  if (!(max - min > 5)) return vacio("El terreno es casi plano en esa zona: escoge un lugar con montañas o barrancas.")
  const n = Math.max(2, Math.min(30, Math.round(o.capas)))
  const esc = o.ancho / Math.max(w, h) // mm por pixel
  const niveles = Array.from({ length: n }, (_, i) => min + ((i + 1) * (max - min)) / (n + 1))
  const contornosDe = (nivel: number): P[][] => {
    const m = new Uint8Array(w * h)
    for (let i = 0; i < m.length; i++) m[i] = (o.invertir ? e[i] <= nivel : e[i] >= nivel) ? 1 : 0
    return curvasDeMascara(m, w, h, { tolerancia: 0.6, manchas: Math.max(6, (w * h) / 3000), suave: true })
      .map((c) => aplanar(c, 0.5).map(([x, y]) => [x * esc, (h - y) * esc] as P))
      .filter((p) => p.length >= 3)
  }
  const W = w * esc, H = h * esc
  const grupos: Trazo[][] = []
  // la base: el rectángulo completo, con la silueta de la capa 1 grabada
  const capas = [[[[0, 0], [W, 0], [W, H], [0, H]] as P[]], ...niveles.map(contornosDe)]
  const avisos: string[] = []
  capas.forEach((c, i) => {
    if (!c.length) return
    const siguiente = capas[i + 1] || []
    grupos.push([...c.map((pts) => ({ pts, cerrado: true, capa: "corte" })), ...siguiente.map((pts) => ({ pts, cerrado: true, capa: "marcar" }))])
  })
  const vacias = capas.filter((c) => !c.length).length
  if (vacias) avisos.push(`${vacias} capas quedan vacías: usa menos capas.`)
  const r = acomodarEnHojas(grupos, o.hoja, 6)
  if (r.noCaben) avisos.push(`${r.noCaben} piezas no caben en la hoja: haz el mapa más chico o usa una hoja más grande.`)
  return { dibujo: { trazos: r.trazos, avisos: [], unidades: "mm" }, hojas: r.hojas, noCaben: r.noCaben, niveles, avisos, errores: [] }
}
