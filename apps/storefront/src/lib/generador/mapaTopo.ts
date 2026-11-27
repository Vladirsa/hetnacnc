// Mapa topográfico por capas (2D Studio · Decoración): de las alturas de un
// lugar real salen las piezas para cortar en MDF o acrílico y apilar. Cada capa
// es la tierra que queda arriba de su altura; lleva grabada la silueta de la
// capa de encima para pegarlas en su lugar.
//
// Las alturas vienen de los mosaicos públicos "Terrarium" (AWS Terrain Tiles,
// datos SRTM y otros, libres): el navegador baja las imágenes y las decodifica
// (altura = R·256 + G + B/256 − 32768). Este archivo es la parte pura
// (alturas → piezas) y la cuenta de mosaicos; la descarga está en la pantalla.
import { extruirEn, recortarARect, rectPts } from "@/lib/generador/contornos"
import { acomodarEnHojas } from "@/lib/generador/geo2d"
import { mascaraAMM } from "@/lib/generador/llaveros"
import { curvasDeMascara } from "@/lib/generador/trazado"
import { type Dibujo, type Malla, type P, type Trazo, conPartes } from "@/lib/generador/vectores"

export const MOSAICOS = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"
/** Crédito de las alturas para lugares de México (las fichas del catálogo). */
export const CREDITO = "Alturas: Mapzen Terrain Tiles (AWS). Datos de México: INEGI, Relieve continental, 2016; SRTM y GMTED2010 cortesía del U.S. Geological Survey; ETOPO1 de NOAA."
/** Crédito completo (la herramienta acepta cualquier lugar): las atribuciones que piden las fuentes de los mosaicos. */
export const CREDITO_GLOBAL =
  "Alturas: Mapzen Terrain Tiles (AWS). México: INEGI, Relieve continental, 2016. EE.UU.: 3DEP; SRTM y GMTED2010 cortesía del U.S. Geological Survey. Mundo: ETOPO1 de NOAA. Canadá: Open Government Licence – Canada. Europa: Copernicus EU-DEM. Reino Unido: © Environment Agency 2015. Noruega: © Kartverket. Austria: © offene Daten Österreichs (DGM). Australia: © Commonwealth of Australia (Geoscience Australia) 2017. Nueva Zelanda: © Crown copyright, LINZ. Ártico: ArcticDEM (DigitalGlobe, NSF 1043681, 1559691 y 1542736)."

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
  // el cuadro no puede salirse de la proyección (±85°): se recorre el centro hacia el ecuador
  lat = Math.sign(lat) * Math.min(Math.abs(lat), 85 - dLat)
  const dLon = dLat / Math.cos((lat * Math.PI) / 180)
  // zoom: que el cuadro mida ~300 px (256 px por mosaico)
  let z = 1
  for (; z < 14; z++) if ((lonAX(lon + dLon, z) - lonAX(lon - dLon, z)) * 256 >= 300) break
  const x0 = lonAX(lon - dLon, z), x1 = lonAX(lon + dLon, z)
  const y0 = latAY(lat + dLat, z), y1 = latAY(lat - dLat, z) // y crece hacia el sur
  const tiles: { x: number; y: number; url: string }[] = []
  for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) tiles.push({ x: tx, y: ty, url: `${MOSAICOS}/${z}/${((tx % 2 ** z) + 2 ** z) % 2 ** z}/${ty}.png` })
  return { z, tiles, recorte: { x0: x0 * 256, y0: y0 * 256, x1: x1 * 256, y1: y1 * 256 }, tx0: Math.floor(x0), ty0: Math.floor(y0) }
}

/** Píxeles RGBA de Terrarium → metros. */
export const alturaTerrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768

/** Lado de la cuadrícula de alturas: el mismo en la página y en el catálogo (así "Modificar" da la pieza de la foto). */
export const LADO_ALTURAS = 160

/**
 * Los mosaicos (RGBA de 256 × 256, en el orden de `plan.tiles`) → la cuadrícula
 * de alturas (m, enteras) del recorte, de `lado` px en el lado largo. La usan la
 * página (que baja las imágenes) y scripts/alturas-mapas.ts (catálogo).
 */
export function rejillaAlturas(plan: ReturnType<typeof planMosaicos>, mosaicos: ArrayLike<number>[], lado = LADO_ALTURAS) {
  const { recorte: r, tx0, ty0 } = plan
  const rx = Math.floor(r.x0 - tx0 * 256), ry = Math.floor(r.y0 - ty0 * 256)
  const rw = Math.ceil(r.x1 - r.x0), rh = Math.ceil(r.y1 - r.y0)
  const indice = new Map(plan.tiles.map((t, i) => [`${t.x - tx0},${t.y - ty0}`, i]))
  const k = Math.max(1, Math.max(rw, rh) / lado)
  const w = Math.max(8, Math.round(rw / k)), h = Math.max(8, Math.round(rh / k))
  const alt = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = rx + Math.min(rw - 1, Math.floor(x * k)), gy = ry + Math.min(rh - 1, Math.floor(y * k))
      const m = mosaicos[indice.get(`${Math.floor(gx / 256)},${Math.floor(gy / 256)}`) ?? -1]
      if (!m) continue
      const o = ((gy % 256) * 256 + (gx % 256)) * 4
      alt[y * w + x] = Math.round(alturaTerrarium(m[o], m[o + 1], m[o + 2]))
    }
  return { alt, w, h }
}

/** El lugar y las medidas del mapa en la liga de la herramienta (?lat&lon&km&capas&ancho). */
export type LigaMapa = { lat: number; lon: number; km: number; capas?: number; ancho?: number }
export const aUrlMapa = (m: LigaMapa) =>
  new URLSearchParams(Object.entries(m).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
/** Lee la liga; sólo regresa lo que es válido (lugar completo, capas 2–30, ancho 50–1500 mm). */
export function deUrlMapa(busqueda: string): Partial<LigaMapa> {
  const q = new URLSearchParams(busqueda)
  const n = (k: string) => (q.get(k)?.trim() ? Number(q.get(k)) : NaN)
  const lat = n("lat"), lon = n("lon"), km = n("km"), capas = n("capas"), ancho = n("ancho")
  return {
    ...(Math.abs(lat) <= 84 && Math.abs(lon) <= 180 && km >= 1 && km <= 300 ? { lat, lon, km } : {}),
    ...(capas >= 2 && capas <= 30 ? { capas: Math.round(capas) } : {}),
    ...(ancho >= 50 && ancho <= 1500 ? { ancho } : {}),
  }
}

// ── alturas → piezas ───────────────────────────────────────────────────────
export type OpcionesMapa = {
  capas: number // cuántas capas (sin contar la base)
  ancho: number // mm de la pieza terminada (el lado largo)
  hoja: { ancho: number; alto: number } // material para acomodar las piezas
  invertir: boolean // profundidad (lagos, mar): la capa es lo que queda abajo
}

export type ResultadoMapa = { dibujo: Dibujo; hojas: number; noCaben: number; piezas: number; niveles: number[]; avisos: string[]; errores: string[] }

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

/** Las capas del mapa en mm (Y hacia arriba): la base (rectángulo W × H) y los contornos de cada nivel. */
export function capasMapa(alturas: Float32Array, w: number, h: number, o: Pick<OpcionesMapa, "capas" | "ancho" | "invertir">) {
  const falla = (e: string) => ({ capas: [] as P[][][], niveles: [] as number[], errores: [e] })
  if (w < 8 || h < 8 || alturas.length !== w * h) return falla("No hay alturas para ese lugar.")
  const e = suavizar(alturas, w, h)
  let min = Infinity, max = -Infinity
  for (const v of e) (min = Math.min(min, v)), (max = Math.max(max, v))
  if (!(max - min > 5)) return falla("El terreno es casi plano en esa zona: escoge un lugar con montañas o barrancas.")
  const n = Math.max(2, Math.min(30, Math.round(o.capas)))
  const esc = o.ancho / Math.max(w, h) // mm por pixel
  const W = w * esc, H = h * esc
  const niveles = Array.from({ length: n }, (_, i) => min + ((i + 1) * (max - min)) / (n + 1))
  const contornosDe = (nivel: number): P[][] => {
    const m = new Uint8Array(w * h)
    for (let i = 0; i < m.length; i++) m[i] = (o.invertir ? e[i] <= nivel : e[i] >= nivel) ? 1 : 0
    const c = mascaraAMM(curvasDeMascara(m, w, h, { tolerancia: 0.6, manchas: Math.max(6, (w * h) / 3000), suave: true }), h, esc)
    // la curva suavizada puede salirse un poco donde la capa toca la orilla: se recorta a la base
    return recortarARect(c, 0, 0, W, H)
  }
  // la base: el rectángulo completo; luego una por nivel
  const capas: P[][][] = [[rectPts(0, 0, W, H)], ...niveles.map(contornosDe)]
  return { capas, niveles, errores: [] as string[] }
}

export function piezasMapa(alturas: Float32Array, w: number, h: number, o: OpcionesMapa): ResultadoMapa {
  const c = capasMapa(alturas, w, h, o)
  if (c.errores.length) return { dibujo: { trazos: [], avisos: [], unidades: "mm" }, hojas: 0, noCaben: 0, piezas: 0, niveles: [], avisos: [], errores: c.errores }
  const { capas, niveles } = c
  const grupos: Trazo[][] = []
  const avisos: string[] = []
  capas.forEach((cs, i) => {
    if (!cs.length) return
    const siguiente = capas[i + 1] || []
    // corte en rojo y guía en azul: en el SVG/PDF quedan en capas distintas (la guía se raya, no se corta)
    grupos.push([...cs.map((pts) => ({ pts, cerrado: true, capa: "corte", color: "#FF0000" })), ...siguiente.map((pts) => ({ pts, cerrado: true, capa: "marcar", color: "#0000FF" }))])
  })
  const vacias = capas.filter((cs) => !cs.length).length
  if (vacias) avisos.push(`${vacias} capas quedan vacías: usa menos capas.`)
  const r = acomodarEnHojas(grupos, o.hoja, 6)
  if (r.noCaben) avisos.push(`${r.noCaben} piezas no caben en la hoja: haz el mapa más chico o usa una hoja más grande.`)
  return { dibujo: { trazos: r.trazos, avisos: [], unidades: "mm" }, hojas: r.hojas, noCaben: r.noCaben, piezas: grupos.length, niveles, avisos, errores: [] }
}

// ── para impresora 3D ──────────────────────────────────────────────────────
export const OPCIONES_MAPA_3D = { base: 2, grosorCapa: 2, cumbre: 0.3 } // cumbre: fracción de capas de arriba (2.º color)
export type OpcionesMapa3D = { capas: number; ancho: number } & Partial<typeof OPCIONES_MAPA_3D>

/**
 * El mapa como una pieza para imprimir (sólo alturas: en profundidad quedaría
 * de cabeza): la base y cada capa encima de la anterior, cada una sólo en su
 * grosor (así el volumen y los gramos salen bien). Dos partes para imprimir a
 * dos colores: base y montaña, y la cumbre. `porCapa`: triángulos de la base y
 * de cada capa, en el mismo orden que la malla (para la foto en degradado).
 */
export function mallaMapa(alturas: Float32Array, w: number, h: number, opciones: OpcionesMapa3D): { malla: Malla; alto: number; porCapa: number[]; errores: string[] } {
  const o = { ...OPCIONES_MAPA_3D, ...opciones }
  const c = capasMapa(alturas, w, h, { ...o, invertir: false })
  if (c.errores.length) return { malla: { tris: [], avisos: [] }, alto: 0, porCapa: [], errores: c.errores }
  const base = Math.max(0.6, Math.min(10, o.base)), g = Math.max(0.2, Math.min(10, o.grosorCapa))
  const piezas = c.capas.map((cs, i) => (cs.length ? (i === 0 ? extruirEn(cs, base, 0) : extruirEn(cs, g, base + (i - 1) * g)) : []))
  const niveles = piezas.length - 1
  const desde = 1 + Math.max(1, Math.min(niveles - 1, Math.round(niveles * (1 - Math.max(0, Math.min(0.9, o.cumbre))))))
  const malla = conPartes(["Base y montaña", piezas.slice(0, desde).flat()], ["Cumbre", piezas.slice(desde).flat()])
  return { malla, alto: base + niveles * g, porCapa: piezas.map((t) => t.length / 9), errores: [] }
}
