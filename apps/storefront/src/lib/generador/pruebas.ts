// Pruebas para calibrar la máquina (2D Studio · Archivos · Pruebas):
//  · Kerf: un marco con 10 tiras; juntas las tiras y mides el hueco: kerf = hueco ÷ 11.
//  · Ajuste: un peine con ranuras de distintos anchos y una lengüeta del
//    espesor del material: la ranura donde entra justa te dice el ajuste.
//  · Matriz de material: cuadros de potencia × velocidad, cada uno de un color
//    distinto (capas de LightBurn) para grabar y escoger el mejor.
import { rectPts as rect } from "@/lib/generador/contornos"
import { cajaDibujo as cajaT, mover } from "@/lib/generador/geo2d"
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

/** Texto chico ya pasado a trazos (lo da la pantalla con la tipografía cargada). */
export type Rotulador = (texto: string, alto: number, capa: string) => Trazo[]

const moverT = (t: Trazo[], dx: number, dy: number): Trazo[] => t.map((x) => ({ ...x, pts: mover(x.pts, dx, dy) }))
/** Rótulo centrado en (cx, cy). */
function rotulo(r: Rotulador | null, texto: string, alto: number, cx: number, cy: number, capa = "grabado"): Trazo[] {
  if (!r) return []
  const t = r(texto, alto, capa)
  if (!t.length) return []
  const b = cajaT(t)
  return moverT(t, cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2)
}

export type ResultadoPrueba = { dibujo: Dibujo; ancho: number; alto: number; avisos: string[]; leyenda?: string[] }

// ── Kerf ───────────────────────────────────────────────────────────────────
/** Marco de 10 tiras de 10 mm (100 mm por dentro): juntas las tiras y mides el hueco. */
export function pruebaKerf(rotular: Rotulador | null): ResultadoPrueba {
  const M = 8, N = 10, A = 10, L = 40
  const W = N * A + 2 * M, H = L + 2 * M + 8
  const t: Trazo[] = [{ pts: rect(0, 0, W, H), cerrado: true, capa: "corte" }]
  // las tiras: cortes verticales entre ellas y el contorno de adentro
  for (let i = 0; i < N; i++) t.push({ pts: rect(M + i * A, M, M + (i + 1) * A, M + L), cerrado: true, capa: "corte" })
  t.push(...rotulo(rotular, "KERF = HUECO / 11", 4, W / 2, H - 5))
  return { dibujo: { trazos: t, avisos: [], unidades: "mm" }, ancho: W, alto: H, avisos: [] }
}

// ── Ajuste (peine y lengüeta) ──────────────────────────────────────────────
export function pruebaAjuste(espesor: number, paso: number, rotular: Rotulador | null): ResultadoPrueba {
  const e = Math.max(0.5, Math.min(30, espesor || 3)), p = Math.max(0.01, Math.min(0.5, paso || 0.05))
  const anchos = Array.from({ length: 9 }, (_, i) => +(e + (i - 4) * p).toFixed(3))
  const SEP = 6, PROF = 12, M = 6
  let x = M
  const ranuras: P[][] = []
  const rotulos: Trazo[] = []
  for (const w of anchos) {
    ranuras.push(rect(x, 0, x + w, PROF))
    rotulos.push(...rotulo(rotular, (w - e >= 0 ? "+" : "") + (w - e).toFixed(2), 2.6, x + w / 2, PROF + 4))
    x += w + SEP
  }
  const W = x - SEP + M, H = PROF + 10
  // contorno del peine con las ranuras abiertas abajo (un solo contorno)
  const contorno: P[] = [[0, 0]]
  for (const r of ranuras) contorno.push([r[0][0], 0], [r[0][0], PROF], [r[1][0], PROF], [r[1][0], 0])
  contorno.push([W, 0], [W, H], [0, H])
  const t: Trazo[] = [{ pts: contorno, cerrado: true, capa: "corte" }, ...rotulos]
  // la lengüeta (del espesor: se mete en las ranuras), abajo del peine
  const lengueta: Trazo = { pts: rect(M, -PROF - 30, M + 60, -30), cerrado: true, capa: "corte" }
  t.push(lengueta, ...rotulo(rotular, `LENGUETA ${e} MM`, 3, M + 30, -30 - PROF / 2))
  const b = cajaT(t)
  return { dibujo: { trazos: moverT(t, -b.x0, -b.y0), avisos: [], unidades: "mm" }, ancho: b.x1 - b.x0, alto: b.y1 - b.y0, avisos: [] }
}

// ── Matriz de material ─────────────────────────────────────────────────────
// Colores de capas de LightBurn (00 negro, 01 azul, 02 rojo, 03 verde…): al
// importar el SVG cada cuadro cae en su capa y se le pone su potencia y velocidad.
const CAPAS_LB = [
  "#0000FF", "#FF0000", "#00E000", "#D0D000", "#FF8000", "#00E0E0", "#FF00FF", "#B4B4B4", "#0000A0", "#A00000",
  "#00A000", "#A0A000", "#C08000", "#00A0FF", "#A000A0", "#808080", "#7D87B9", "#BB7784", "#4A6FE3", "#D33F6A",
  "#8CD78C", "#F0B98D", "#F6C4E1", "#FA9ED4", "#500A78", "#B45A00", "#004754", "#86FA88", "#FFDB66", "#000000",
]
export const MAX_CELDAS = CAPAS_LB.length

export type OpcionesMatriz = { potencias: number[]; velocidades: number[]; lado: number; unidad: string }

export function matrizMaterial(o: OpcionesMatriz, rotular: Rotulador | null): ResultadoPrueba {
  const P_ = o.potencias.slice(0, 10), V = o.velocidades.slice(0, 10)
  const avisos: string[] = []
  if (P_.length * V.length > MAX_CELDAS) avisos.push(`Son ${P_.length * V.length} cuadros: LightBurn sólo tiene ${MAX_CELDAS} colores de capa; los últimos repiten color.`)
  const L = Math.max(5, Math.min(30, o.lado || 10)), G = 3, IZQ = 16, ABAJO = 10
  const t: Trazo[] = []
  const leyenda: string[] = ["Capa (color),Potencia %,Velocidad " + o.unidad]
  P_.forEach((pot, i) => {
    t.push(...rotulo(rotular, `${pot}%`, 3, IZQ / 2, ABAJO + i * (L + G) + L / 2))
    V.forEach((vel, j) => {
      const n = i * V.length + j
      const color = CAPAS_LB[n % CAPAS_LB.length]
      const x0 = IZQ + j * (L + G), y0 = ABAJO + i * (L + G)
      t.push({ pts: rect(x0, y0, x0 + L, y0 + L), cerrado: true, capa: `P${pot}-V${vel}`, color })
      leyenda.push(`${String(n).padStart(2, "0")} (${color}),${pot},${vel}`)
    })
  })
  V.forEach((vel, j) => t.push(...rotulo(rotular, String(vel), 2.6, IZQ + j * (L + G) + L / 2, ABAJO / 2)))
  const W = IZQ + V.length * (L + G) - G + 4, H = ABAJO + P_.length * (L + G) - G + 8
  t.push(...rotulo(rotular, `POTENCIA % / VELOCIDAD ${o.unidad.toUpperCase()}`, 3, W / 2, H - 3))
  t.unshift({ pts: rect(0, 0, W, H), cerrado: true, capa: "corte" })
  return { dibujo: { trazos: t, avisos: [], unidades: "mm" }, ancho: W, alto: H, avisos, leyenda }
}

/** "10, 20, 30" o "10-100/10" → números (máx. 10). */
export function leerSerie(s: string): number[] {
  const r = s.trim().match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (r) {
    const [a, b, p] = [Number(r[1]), Number(r[2]), Number(r[3])]
    if (!(p > 0)) return []
    const out: number[] = []
    for (let x = a; (p > 0 ? x <= b + 1e-9 : false) && out.length < 10; x += p) out.push(+x.toFixed(3))
    return out
  }
  return s.split(/[,;\s]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0).slice(0, 10)
}
