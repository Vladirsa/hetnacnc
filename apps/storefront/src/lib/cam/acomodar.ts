// Acomoda varias copias de una pieza en la hoja para cortarlas en un solo
// programa. Prueba dos formas, con la pieza derecha y girada 90°:
//
//  · En cuadrícula: filas y columnas por la caja que envuelve a la pieza.
//  · Encajadas: una copia derecha y la siguiente volteada 180°, metida en el
//    hueco de la anterior (triángulos, escuadras, piezas en L, T o C). Se mide
//    el perfil real de la pieza renglón por renglón, así que respeta la
//    separación que pidas en todo el contorno.
//
// Se queda con la que acomoda más copias y, si empatan, con la que ocupa
// menos hoja. Todas las copias son de la misma pieza.
import type { Dibujo, P } from "@/lib/generador/vectores"

export type Hoja = { copias: number; ancho: number; largo: number; separacion: number }
export type Acomodo = {
  dibujo: Dibujo
  /** Cuántas copias quedaron (puede ser menos de las pedidas si no caben) */
  puestas: number
  /** Cuántas caben en la hoja con este acomodo */
  caben: number
  girada: boolean
  /** true si las copias van volteadas una sí y una no, metidas unas en otras */
  encajadas: boolean
  /** Lo que ocupan las copias puestas (mm) */
  ocupa: [number, number]
  aviso: string | null
}

type Sitio = { x: number; y: number; vuelta: boolean }
type Opcion = { caben: number; sitios: Sitio[]; ocupa: [number, number]; girada: boolean; encajadas: boolean }

/** Hasta dónde llega la pieza a la izquierda y a la derecha en cada renglón, engordada media separación. */
function perfil(trazos: P[][], w: number, h: number, sep: number) {
  const n = Math.min(400, Math.max(40, Math.ceil(h / 0.5)))
  const s = h / n
  const izq = new Float64Array(n).fill(Infinity), der = new Float64Array(n).fill(-Infinity)
  const marcar = (x: number, y: number) => {
    for (const e of [-0.01, 0.01]) {
      const j = Math.min(n - 1, Math.max(0, Math.floor(y / s + e)))
      if (x < izq[j]) izq[j] = x
      if (x > der[j]) der[j] = x
    }
  }
  for (const pts of trazos)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      marcar(a[0], a[1])
      if (i + 1 >= pts.length) continue
      const b = pts[i + 1], m = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (s / 2))
      for (let q = 1; q < m; q++) marcar(a[0] + ((b[0] - a[0]) * q) / m, a[1] + ((b[1] - a[1]) * q) / m)
    }
  // renglón sin trazo (dibujo abierto): se toma el ancho completo, que es lo seguro
  for (let j = 0; j < n; j++) if (izq[j] > der[j]) { izq[j] = 0; der[j] = w }
  const k = Math.ceil(sep / 2 / s) + 1, m = n + 2 * k
  const I = new Float64Array(m), D = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    let a = Infinity, b = -Infinity
    for (let j = Math.max(0, i - 2 * k); j <= Math.min(n - 1, i); j++) {
      if (izq[j] < a) a = izq[j]
      if (der[j] > b) b = der[j]
    }
    I[i] = a - sep / 2
    D[i] = b + sep / 2
  }
  return { n, s, m, I, D }
}

function opciones(trazos: P[][], w: number, h: number, hj: Hoja, sep: number, pedidas: number, girada: boolean): Opcion[] {
  const out: Opcion[] = []
  const cerrar = (sitios: Sitio[], caben: number, encajadas: boolean) => {
    let x1 = 0, y1 = 0
    for (const q of sitios) {
      if (q.x + w > x1) x1 = q.x + w
      if (q.y + h > y1) y1 = q.y + h
    }
    out.push({ caben, sitios, ocupa: [x1, y1], girada, encajadas })
  }
  // cuadrícula
  const cols = Math.max(0, Math.floor((hj.ancho + sep) / (w + sep))), filas = Math.max(0, Math.floor((hj.largo + sep) / (h + sep)))
  if (cols * filas > 0) {
    const sitios: Sitio[] = []
    for (let k = 0; k < Math.min(pedidas, cols * filas); k++) sitios.push({ x: (k % cols) * (w + sep), y: Math.floor(k / cols) * (h + sep), vuelta: false })
    cerrar(sitios, cols * filas, false)
  }
  if (w > hj.ancho + 1e-6) return out
  // encajadas: A derecha, B volteada 180° y corrida r renglones; se repite A B A B…
  const pf = perfil(trazos, w, h, sep), { m, I, D, s } = pf
  const BI = (i: number) => w - D[m - 1 - i], BD = (i: number) => w - I[m - 1 - i]
  let dAA = -Infinity
  for (let i = 0; i < m; i++) if (D[i] - I[i] > dAA) dAA = D[i] - I[i]
  const paso = Math.max(1, Math.round((pf.n - 1) / 40))
  for (let r = -(pf.n - 1); r <= pf.n - 1; r += paso) {
    let d1 = -Infinity, d2 = -Infinity
    for (let a = Math.max(0, r); a < Math.min(m, m + r); a++) {
      const b = a - r
      if (D[a] - BI(b) > d1) d1 = D[a] - BI(b)
      if (BD(b) - I[a] > d2) d2 = BD(b) - I[a]
    }
    if (!isFinite(d1) || d1 < 0) continue
    const P_ = Math.max(d1 + d2, dAA)
    if (!(P_ > 0.5) || d1 > P_) continue
    const alto = h + Math.abs(r) * s
    const nA = Math.floor((hj.ancho - w) / P_ + 1e-9) + 1
    const nB = hj.ancho - w - d1 >= 0 ? Math.floor((hj.ancho - w - d1) / P_ + 1e-9) + 1 : 0
    const nF = Math.max(0, Math.floor((hj.largo + sep) / (alto + sep)))
    const caben = (nA + nB) * nF
    if (nB === 0 || caben === 0) continue
    const sitios: Sitio[] = []
    const yA = r < 0 ? -r * s : 0
    for (let f = 0; f < nF && sitios.length < pedidas; f++)
      for (let i = 0; i < nA && sitios.length < pedidas; i++) {
        sitios.push({ x: i * P_, y: f * (alto + sep) + yA, vuelta: false })
        if (i < nB && sitios.length < pedidas) sitios.push({ x: i * P_ + d1, y: f * (alto + sep) + yA + r * s, vuelta: true })
      }
    cerrar(sitios, caben, true)
  }
  return out
}

export function acomodarCopias(d: Dibujo, h: Hoja): Acomodo {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of d.trazos)
    for (const [x, y] of t.pts) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  const w = x1 - x0, al = y1 - y0
  const pedidas = Math.max(1, Math.min(500, Math.round(h.copias) || 1))
  const sep = Math.max(0, h.separacion || 0)
  const sola: Acomodo = { dibujo: d, puestas: 1, caben: 1, girada: false, encajadas: false, ocupa: [Math.max(0, w), Math.max(0, al)], aviso: null }
  if (pedidas === 1 || !(w > 0) || !(al > 0)) return sola

  // la pieza llevada al origen, derecha y girada 90°
  const derecha = d.trazos.map((t) => t.pts.map((p): P => [p[0] - x0, p[1] - y0]))
  const girada = d.trazos.map((t) => t.pts.map((p): P => [y1 - p[1], p[0] - x0]))
  const todas = [...opciones(derecha, w, al, h, sep, pedidas, false), ...opciones(girada, al, w, h, sep, pedidas, true)]
  if (!todas.length) {
    return { ...sola, caben: 0, aviso: `La pieza (${w.toFixed(0)} × ${al.toFixed(0)} mm) no cabe en una hoja de ${h.ancho} × ${h.largo} mm.` }
  }
  // más copias puestas; luego menos hoja ocupada (encajar debe ahorrar al menos 3 % para valer la pena)
  const valor = (o: Opcion) => o.ocupa[0] * o.ocupa[1] * (o.encajadas ? 1.03 : 1)
  let mejor = todas[0]
  for (const o of todas) {
    const a = Math.min(pedidas, o.caben), b = Math.min(pedidas, mejor.caben)
    if (a > b || (a === b && valor(o) < valor(mejor) - 1e-6)) mejor = o
  }
  const base = mejor.girada ? girada : derecha
  const pw = mejor.girada ? al : w, ph = mejor.girada ? w : al
  const trazos: Dibujo["trazos"] = []
  for (const q of mejor.sitios)
    d.trazos.forEach((t, i) => trazos.push({ ...t, pts: base[i].map((p): P => (q.vuelta ? [q.x + pw - p[0], q.y + ph - p[1]] : [q.x + p[0], q.y + p[1]])) }))
  const puestas = mejor.sitios.length
  // lo más que cabe en la hoja, aunque para pocas copias se haya elegido el acomodo que ocupa menos
  const caben = Math.max(...todas.map((o) => o.caben))
  return {
    dibujo: { ...d, trazos },
    puestas,
    caben,
    girada: mejor.girada,
    encajadas: mejor.encajadas,
    ocupa: mejor.ocupa,
    aviso: puestas < pedidas ? `En la hoja caben ${caben} copias; se acomodaron ${puestas} de las ${pedidas} que pediste. Las demás van en otra hoja.` : null,
  }
}
