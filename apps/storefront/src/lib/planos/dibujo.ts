// Dibujos de la lámina de un plano HETNA, en SVG (texto), sin navegador:
// isométrico del mueble armado con cotas, vista explotada, pasos de armado y
// acomodo de las piezas en la hoja.
import type { HojaAcomodada } from "@/lib/generador/acomodoHojas"
import { HOJA } from "./calculo"
import type { PiezaPlano } from "./modelos"

type P = [number, number]
const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6)
// proyección isométrica: se ve el frente (y = 0), el lado derecho y arriba
const iso = (x: number, y: number, z: number): P => [(x + y) * C, (x - y) * S - z]
const f = (n: number) => Math.round(n * 10) / 10
const pts = (ps: P[]) => ps.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

const MADERA = { arriba: "#F1DDB5", frente: "#E2C38F", lado: "#C9A46B", linea: "#6B4E2A" }
const RESALTE = { arriba: "#FFD3A8", frente: "#FF9F57", lado: "#E07B2E", linea: "#8A3A00" }
const TENUE = { arriba: "#F4EEE3", frente: "#ECE3D2", lado: "#DED1B8", linea: "#B9A88A" }
const RUEDA = { arriba: "#5B6068", frente: "#3A3F46", lado: "#2B2F35", linea: "#1B1B18" }

/** Cuatro ruedas (cajas oscuras) bajo la pieza más baja, si el plano lleva ruedas. */
export function cajasRuedas(piezas: PiezaPlano[], alto?: number): Caja[] {
  if (!alto) return []
  const zMin = Math.min(...piezas.map((q) => q.z0))
  const base = piezas.filter((q) => q.z0 === zMin)
  const x0 = Math.min(...base.map((q) => q.x0)), x1 = Math.max(...base.map((q) => q.x1))
  const y0 = Math.min(...base.map((q) => q.y0)), y1 = Math.max(...base.map((q) => q.y1))
  const t = 70, m = 50
  return [[x0 + m, y0 + m], [x1 - m - t, y0 + m], [x0 + m, y1 - m - t], [x1 - m - t, y1 - m - t]]
    .map(([x, y]) => ({ x0: x, x1: x + t, y0: y, y1: y + t, z0: zMin - alto, z1: zMin }))
}

type Caja = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
type Estilo = typeof MADERA

function caras(b: Caja, e: Estilo, grosorLinea: number) {
  const { x0, x1, y0, y1, z0, z1 } = b
  const arriba = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)]
  const frente = [iso(x0, y0, z0), iso(x1, y0, z0), iso(x1, y0, z1), iso(x0, y0, z1)]
  const lado = [iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)]
  const st = `stroke="${e.linea}" stroke-width="${grosorLinea}" stroke-linejoin="round"`
  return `<polygon points="${pts(frente)}" fill="${e.frente}" ${st}/><polygon points="${pts(lado)}" fill="${e.lado}" ${st}/><polygon points="${pts(arriba)}" fill="${e.arriba}" ${st}/>`
}

// Orden de pintado de cajas que no se enciman: A va detrás de B si queda
// del todo atrás (y mayor), a la izquierda (x menor) o abajo (z menor) de B.
// Se ordena con esa relación (orden topológico); en empates, por la esquina.
const detras = (a: Caja, b: Caja) => a.y0 >= b.y1 - 0.01 || a.x1 <= b.x0 + 0.01 || a.z1 <= b.z0 + 0.01
function ordenar<T extends Caja>(cs: T[]): T[] {
  const n = cs.length
  const antes: number[][] = cs.map(() => [])
  const pend = new Array(n).fill(0)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue
    // i detrás de j y j no detrás de i (si las dos cosas se cumplen, no se decide aquí)
    if (detras(cs[i], cs[j]) && !detras(cs[j], cs[i])) { antes[i].push(j); pend[j]++ }
  }
  const clave = (b: Caja) => b.x1 - b.y0 + b.z1
  const listos = cs.map((_, i) => i).filter((i) => pend[i] === 0)
  const out: T[] = []
  const visto = new Array(n).fill(false)
  while (out.length < n) {
    if (!listos.length) { // ciclo: se rompe con la más lejana pendiente
      const i = cs.map((_, k) => k).filter((k) => !visto[k]).sort((a, b) => clave(cs[a]) - clave(cs[b]))[0]
      listos.push(i)
    }
    listos.sort((a, b) => clave(cs[a]) - clave(cs[b]))
    const i = listos.shift()!
    if (visto[i]) continue
    visto[i] = true
    out.push(cs[i])
    for (const j of antes[i]) if (--pend[j] === 0 && !visto[j]) listos.push(j)
  }
  return out
}

function limites(cs: Caja[]) {
  const ps = cs.flatMap((b) => [iso(b.x0, b.y0, b.z0), iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x0, b.y1, b.z0), iso(b.x0, b.y0, b.z1), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)])
  const xs = ps.map((q) => q[0]), ys = ps.map((q) => q[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

function svg(cuerpo: string, l: { x0: number; x1: number; y0: number; y1: number }, margen: number, titulo: string) {
  const w = l.x1 - l.x0 + 2 * margen, h = l.y1 - l.y0 + 2 * margen
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(l.x0 - margen)} ${f(l.y0 - margen)} ${f(w)} ${f(h)}" role="img" aria-label="${esc(titulo)}" style="width:100%;height:auto">${cuerpo}</svg>`
}

function cota(a: P, b: P, texto: string, desplaz: P, tam: number) {
  const a2: P = [a[0] + desplaz[0], a[1] + desplaz[1]], b2: P = [b[0] + desplaz[0], b[1] + desplaz[1]]
  const m: P = [(a2[0] + b2[0]) / 2 + desplaz[0] * 0.35, (a2[1] + b2[1]) / 2 + desplaz[1] * 0.35]
  const col = "#B34D07"
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(a2[0])}" y2="${f(a2[1])}" stroke="${col}" stroke-width="${tam * 0.06}" stroke-dasharray="${tam * 0.3} ${tam * 0.2}"/>` +
    `<line x1="${f(b[0])}" y1="${f(b[1])}" x2="${f(b2[0])}" y2="${f(b2[1])}" stroke="${col}" stroke-width="${tam * 0.06}" stroke-dasharray="${tam * 0.3} ${tam * 0.2}"/>` +
    `<line x1="${f(a2[0])}" y1="${f(a2[1])}" x2="${f(b2[0])}" y2="${f(b2[1])}" stroke="${col}" stroke-width="${tam * 0.09}"/>` +
    `<circle cx="${f(a2[0])}" cy="${f(a2[1])}" r="${tam * 0.18}" fill="${col}"/><circle cx="${f(b2[0])}" cy="${f(b2[1])}" r="${tam * 0.18}" fill="${col}"/>` +
    `<text x="${f(m[0])}" y="${f(m[1])}" font-size="${tam}" font-family="Inter,Arial,sans-serif" font-weight="700" fill="${col}" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#FAF9F6" stroke-width="${tam * 0.35}">${esc(texto)}</text>`
}

/** El mueble armado en isométrico, con las cotas generales (mm). */
export function svgArmado(piezas: PiezaPlano[], titulo: string, ruedas: Caja[] = []) {
  const todas: Caja[] = [...piezas, ...ruedas]
  const l = limites(todas)
  const tam = Math.max(l.x1 - l.x0, l.y1 - l.y0)
  const lin = tam * 0.0025
  const X0 = Math.min(...todas.map((q) => q.x0)), X1 = Math.max(...todas.map((q) => q.x1))
  const Y0 = Math.min(...todas.map((q) => q.y0)), Y1 = Math.max(...todas.map((q) => q.y1))
  const Z0 = Math.min(...todas.map((q) => q.z0)), Z1 = Math.max(...todas.map((q) => q.z1))
  const t = tam * 0.032
  const d = tam * 0.06
  const cuerpo = ordenar(todas).map((q) => caras(q, ruedas.includes(q) ? RUEDA : MADERA, lin)).join("") +
    cota(iso(X0, Y0, Z0), iso(X1, Y0, Z0), `${f(X1 - X0)} mm`, [d * 0.5, d * 0.85], t) +
    cota(iso(X1, Y0, Z0), iso(X1, Y1, Z0), `${f(Y1 - Y0)} mm`, [d * 0.5, -d * 0.85 + d], t) +
    cota(iso(X0, Y0, Z0), iso(X0, Y0, Z1), `${f(Z1 - Z0)} mm`, [-d * 1.1, 0], t)
  // un poco más de margen a la izquierda: ahí va la cota del alto
  return svg(cuerpo, { ...l, x0: l.x0 - tam * 0.1 }, tam * 0.17, titulo)
}

/** Vista explotada: cada pieza se separa del centro del mueble. */
export function svgExplotado(piezas: PiezaPlano[], titulo: string) {
  const cx = (Math.min(...piezas.map((q) => q.x0)) + Math.max(...piezas.map((q) => q.x1))) / 2
  const cy = (Math.min(...piezas.map((q) => q.y0)) + Math.max(...piezas.map((q) => q.y1))) / 2
  const cz = (Math.min(...piezas.map((q) => q.z0)) + Math.max(...piezas.map((q) => q.z1))) / 2
  const k = 0.45
  const movidas = piezas.map((q) => {
    const dx = ((q.x0 + q.x1) / 2 - cx) * k, dy = ((q.y0 + q.y1) / 2 - cy) * k, dz = ((q.z0 + q.z1) / 2 - cz) * k
    return { ...q, x0: q.x0 + dx, x1: q.x1 + dx, y0: q.y0 + dy, y1: q.y1 + dy, z0: q.z0 + dz, z1: q.z1 + dz }
  })
  const l = limites(movidas)
  const lin = Math.max(l.x1 - l.x0, l.y1 - l.y0) * 0.0025
  return svg(ordenar(movidas).map((q) => caras(q, MADERA, lin)).join(""), l, Math.max(l.x1 - l.x0, l.y1 - l.y0) * 0.05, titulo)
}

/** Un paso de armado: lo ya armado tenue, lo nuevo resaltado y lo que falta oculto. */
export function svgPaso(piezas: PiezaPlano[], previas: Set<PiezaPlano>, nuevas: Set<PiezaPlano>, titulo: string) {
  const l = limites(piezas) // mismo encuadre en todos los pasos
  const lin = Math.max(l.x1 - l.x0, l.y1 - l.y0) * 0.004
  const visibles = ordenar(piezas.filter((q) => previas.has(q) || nuevas.has(q)))
  const cuerpo = visibles.map((q) => caras(q, nuevas.has(q) ? RESALTE : TENUE, lin)).join("")
  return svg(cuerpo, l, Math.max(l.x1 - l.x0, l.y1 - l.y0) * 0.05, titulo)
}

/** Una hoja de 2440 × 1220 con sus piezas acomodadas y la letra de cada una. */
/** barrenos: dónde caen los barrenos guía de cada pieza colocada (calculo.ts → puntosBarrenos). */
export function svgHoja(
  h: HojaAcomodada,
  titulo: string,
  barrenos?: (c: HojaAcomodada["colocadas"][number]) => [number, number][],
  ranuras?: (c: HojaAcomodada["colocadas"][number]) => [number, number, number, number, number][]
) {
  const m = 60
  const rects = h.colocadas.map((c) => {
    const t = Math.min(c.w, c.h) * 0.45
    const tam = Math.max(40, Math.min(110, t))
    return `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}" fill="#F1DDB5" stroke="#6B4E2A" stroke-width="4"/>` +
      `<text x="${f(c.x + c.w / 2)}" y="${f(c.y + c.h / 2)}" font-size="${f(tam)}" font-family="Inter,Arial,sans-serif" font-weight="800" fill="#142033" text-anchor="middle" dominant-baseline="middle">${esc(c.nombre)}</text>` +
      (ranuras ? ranuras(c).map(([x0, y0, x1, y1]) => `<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="#C9A26B" stroke="#6B4E2A" stroke-width="2" stroke-dasharray="10 6"/>`).join("") : "") +
      (barrenos ? barrenos(c).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="#B34D07"/>`).join("") : "")
  }).join("")
  const cuerpo = `<rect x="0" y="0" width="${HOJA.largo}" height="${HOJA.ancho}" fill="#FFFFFF" stroke="#142033" stroke-width="8"/>${rects}` +
    `<text x="${HOJA.largo / 2}" y="${HOJA.ancho + 48}" font-size="40" font-family="Inter,Arial,sans-serif" fill="#6B6A63" text-anchor="middle">2440 mm</text>` +
    `<text x="-40" y="${HOJA.ancho / 2}" font-size="40" font-family="Inter,Arial,sans-serif" fill="#6B6A63" text-anchor="middle" transform="rotate(-90 -40 ${HOJA.ancho / 2})">1220 mm</text>`
  return svg(cuerpo, { x0: 0, x1: HOJA.largo, y0: 0, y1: HOJA.ancho + 40 }, m + 20, titulo)
}

/** Piezas que entran en cada paso (por nombre o prefijo); las que nadie nombra van al final. */
export function piezasPorPaso(piezas: PiezaPlano[], pasos: { piezas: string[] }[]) {
  const usadas = new Set<PiezaPlano>()
  const porPaso = pasos.map((ps) => {
    const s = new Set<PiezaPlano>()
    for (const q of piezas) if (!usadas.has(q) && ps.piezas.some((n) => q.nombre.startsWith(n))) { s.add(q); usadas.add(q) }
    return s
  })
  const sobran = piezas.filter((q) => !usadas.has(q))
  if (sobran.length && porPaso.length) sobran.forEach((q) => porPaso[porPaso.length - 1].add(q))
  return porPaso
}
