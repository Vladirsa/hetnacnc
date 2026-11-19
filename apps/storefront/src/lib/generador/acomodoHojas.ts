// Acomodo de las piezas de un mueble en hojas de tablero (MDF, triplay, melamina).
//
// - Cada pieza se acomoda por el rectángulo que la envuelve (con sus espigas).
// - Veta por pieza: "largo" (su lado largo sigue la veta de la hoja, a lo largo
//   de la hoja), "ancho" (su lado largo va atravesado a la veta) o "libre" (se
//   puede girar). Sin veta en la hoja, todas son libres.
// - Separación entre piezas (el diámetro de la fresa más un poco) y margen en la
//   orilla de la hoja.
// - MaxRects con varias estrategias (orden y regla de ajuste); se queda con la
//   que usa menos hojas y, a igual número, la que llena más las primeras.
// - Cada pieza lleva su número dibujado (capa ETIQUETA, trazo sencillo) para
//   reconocerla al despegarla de la hoja; la lista de corte dice qué es cada una.
//
// Ejes de la hoja: X a lo largo (la veta), Y a lo ancho. Todo en mm.

import type { Trazo } from "./geo2d"

type P = [number, number]
export type Veta = "largo" | "ancho" | "libre"
export type PiezaHoja = { id: string; nombre: string; trazos: Trazo[]; veta: Veta; cantidad: number }
export type OpcionesHoja = { largo: number; ancho: number; separacion: number; margen: number; conVeta: boolean; etiquetas: boolean; desde?: number /* primer número de pieza - 1 */ }
export type Colocada = { id: string; nombre: string; n: number; x: number; y: number; w: number; h: number; girada: boolean }
export type HojaAcomodada = { colocadas: Colocada[]; usado: number }
export type Acomodo = { hojas: HojaAcomodada[]; noCaben: string[]; aprovechamiento: number; piezas: number; trazos: Trazo[] }

export const HOJAS_TABLERO: { id: string; nombre: string; largo: number; ancho: number }[] = [
  { id: "2440x1220", nombre: "MDF / triplay 2440 × 1220", largo: 2440, ancho: 1220 },
  { id: "2440x1830", nombre: "Melamina 2440 × 1830", largo: 2440, ancho: 1830 },
  { id: "2750x1830", nombre: "Melamina 2750 × 1830", largo: 2750, ancho: 1830 },
  { id: "2800x2070", nombre: "Aglomerado 2800 × 2070", largo: 2800, ancho: 2070 },
  { id: "1300x900", nombre: "Láser 1300 × 900", largo: 1300, ancho: 900 },
]

type R = { x: number; y: number; w: number; h: number }
type Item = { id: string; nombre: string; n: number; w: number; h: number; veta: Veta }

const caja = (ts: Trazo[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of ts) for (const [x, y] of t.pts) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 }
}

// orientaciones permitidas: [ancho en X, alto en Y, girada]
function orientaciones(it: Item, conVeta: boolean): [number, number, boolean][] {
  const normal: [number, number, boolean] = [it.w, it.h, false]
  const girada: [number, number, boolean] = [it.h, it.w, true]
  if (!conVeta || it.veta === "libre") return [normal, girada]
  const largoEnX = it.veta === "largo"
  // el lado largo de la pieza en X (veta a lo largo) o en Y (atravesada)
  return (it.w >= it.h) === largoEnX ? [normal] : [girada]
}

type Regla = "corto" | "area" | "abajo"
function empacar(items: Item[], W: number, H: number, s: number, conVeta: boolean, regla: Regla) {
  const hojas: { libres: R[]; col: Colocada[]; usado: number }[] = []
  const noCaben: Item[] = []
  const elegir = (libres: R[], it: Item) => {
    let mejor: { r: R; girada: boolean; a: number; b: number } | null = null
    for (const [w, h, girada] of orientaciones(it, conVeta)) {
      const ww = w + s, hh = h + s
      for (const f of libres) {
        if (ww > f.w + 1e-6 || hh > f.h + 1e-6) continue
        const a = regla === "corto" ? Math.min(f.w - ww, f.h - hh) : regla === "area" ? f.w * f.h - ww * hh : f.y + hh
        const b = regla === "corto" ? Math.max(f.w - ww, f.h - hh) : regla === "area" ? Math.min(f.w - ww, f.h - hh) : f.x
        if (!mejor || a < mejor.a - 1e-6 || (Math.abs(a - mejor.a) < 1e-6 && b < mejor.b)) mejor = { r: { x: f.x, y: f.y, w: ww, h: hh }, girada, a, b }
      }
    }
    return mejor
  }
  const partir = (libres: R[], u: R) => {
    const nuevos: R[] = []
    for (const f of libres) {
      if (u.x >= f.x + f.w || u.x + u.w <= f.x || u.y >= f.y + f.h || u.y + u.h <= f.y) {
        nuevos.push(f)
        continue
      }
      if (u.x > f.x) nuevos.push({ x: f.x, y: f.y, w: u.x - f.x, h: f.h })
      if (u.x + u.w < f.x + f.w) nuevos.push({ x: u.x + u.w, y: f.y, w: f.x + f.w - u.x - u.w, h: f.h })
      if (u.y > f.y) nuevos.push({ x: f.x, y: f.y, w: f.w, h: u.y - f.y })
      if (u.y + u.h < f.y + f.h) nuevos.push({ x: f.x, y: u.y + u.h, w: f.w, h: f.y + f.h - u.y - u.h })
    }
    return nuevos.filter((a, i) => !nuevos.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)))
  }
  for (const it of items) {
    if (!orientaciones(it, conVeta).some(([w, h]) => w + s <= W + 1e-6 && h + s <= H + 1e-6)) {
      noCaben.push(it)
      continue
    }
    let puesto = false
    for (const hj of hojas) {
      const c = elegir(hj.libres, it)
      if (!c) continue
      hj.col.push({ id: it.id, nombre: it.nombre, n: it.n, x: c.r.x, y: c.r.y, w: c.r.w - s, h: c.r.h - s, girada: c.girada })
      hj.libres = partir(hj.libres, c.r)
      hj.usado += it.w * it.h
      puesto = true
      break
    }
    if (!puesto) {
      const libres = [{ x: 0, y: 0, w: W, h: H }]
      const c = elegir(libres, it)!
      hojas.push({ libres: partir(libres, c.r), col: [{ id: it.id, nombre: it.nombre, n: it.n, x: c.r.x, y: c.r.y, w: c.r.w - s, h: c.r.h - s, girada: c.girada }], usado: it.w * it.h })
    }
  }
  return { hojas, noCaben }
}

export function acomodarEnTablero(piezas: PiezaHoja[], o: OpcionesHoja): Acomodo {
  const s = Math.max(0, o.separacion)
  const m = Math.max(0, o.margen)
  // el área útil se agranda una separación: la última pieza no necesita espacio después
  const W = o.largo - 2 * m + s
  const H = o.ancho - 2 * m + s
  const cajas = new Map(piezas.map((p) => [p.id, caja(p.trazos)]))
  const items: Item[] = []
  let n = Math.max(0, Math.round(o.desde || 0))
  for (const p of piezas) {
    const c = cajas.get(p.id)!
    for (let k = 0; k < Math.max(0, Math.round(p.cantidad)); k++) items.push({ id: p.id, nombre: p.nombre, n: ++n, w: c.w, h: c.h, veta: p.veta })
  }
  const ordenes: ((a: Item, b: Item) => number)[] = [
    (a, b) => b.w * b.h - a.w * a.h,
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
    (a, b) => b.w + b.h - (a.w + a.h),
    (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.w * b.h - a.w * a.h,
  ]
  let mejor: ReturnType<typeof empacar> | null = null
  let puntaje = Infinity
  // órdenes fijos y, además, varios órdenes revueltos (con semilla: siempre da lo mismo)
  let semilla = 12345
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
  const intentos: Item[][] = ordenes.map((orden) => [...items].sort(orden))
  const vueltas = items.length > 150 ? 6 : 24
  for (let k = 0; k < vueltas; k++) {
    // el orden por área, con algunos cambios de lugar
    const base = [...items].sort(ordenes[k % ordenes.length])
    for (let c = 0; c < Math.max(2, base.length / 4); c++) {
      const i = Math.floor(azar() * base.length), j = Math.min(base.length - 1, i + 1 + Math.floor(azar() * 4))
      ;[base[i], base[j]] = [base[j], base[i]]
    }
    intentos.push(base)
  }
  for (const lista of intentos)
    for (const regla of ["corto", "area", "abajo"] as Regla[]) {
      const r = empacar(lista, W, H, s, o.conVeta, regla)
      // menos hojas; luego, las primeras más llenas (la última con lo que sobra)
      const llenado = r.hojas.reduce((t, h) => t + (h.usado / (W * H)) ** 2, 0)
      const p = r.noCaben.length * 1e6 + r.hojas.length * 1e3 - llenado
      if (p < puntaje) {
        puntaje = p
        mejor = r
      }
    }
  const res = mejor || { hojas: [], noCaben: [] }

  // dibujo: hojas una debajo de otra, cada pieza en su lugar (Y del dibujo hacia arriba)
  const trazos: Trazo[] = []
  const sepHojas = 150
  const porId = new Map(piezas.map((p) => [p.id, p]))
  res.hojas.forEach((hj, k) => {
    const oy = -k * (o.ancho + sepHojas)
    trazos.push({ pts: [[0, oy], [o.largo, oy], [o.largo, oy + o.ancho], [0, oy + o.ancho]], cerrado: true, capa: "hoja" })
    for (const c of hj.col) {
      const p = porId.get(c.id)!
      const b = cajas.get(c.id)!
      const X = m + c.x, Y = oy + m + c.y
      const llevar = ([x, y]: P): P => {
        const lx = x - b.x0, ly = y - b.y0
        return c.girada ? [X + (b.h - ly), Y + lx] : [X + lx, Y + ly]
      }
      for (const t of p.trazos) trazos.push({ ...t, pts: t.pts.map(llevar) })
      if (o.etiquetas) {
        // el número va donde no haya huecos ni barrenos: se prueban varios puntos de la pieza
        const alto = Math.max(12, Math.min(40, Math.min(c.w, c.h) * 0.22))
        const txt = String(c.n)
        const ancho = alto * 0.55 * 1.45 * txt.length
        const estorbos = p.trazos
          .filter((t) => t !== p.trazos[0])
          .map((t) => {
            const pts = t.pts.map(llevar)
            return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))]
          })
        const libre = (cx: number, cy: number) => estorbos.every(([a, b, cc, dd]) => cx + ancho / 2 + 4 < a || cx - ancho / 2 - 4 > cc || cy + alto / 2 + 4 < b || cy - alto / 2 - 4 > dd)
        const cands: P[] = []
        for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) for (const fy of [0.5, 0.3, 0.7]) cands.push([X + c.w * fx, Y + c.h * fy])
        const [cx, cy] = cands.find(([a, b]) => libre(a, b)) || cands[0]
        trazos.push(...numero(txt, cx, cy, alto))
      }
    }
  })
  const areaPiezas = res.hojas.reduce((t, h) => t + h.usado, 0)
  return {
    hojas: res.hojas.map((h) => ({ colocadas: h.col.map((c) => ({ ...c, x: c.x + m, y: c.y + m })), usado: h.usado })),
    noCaben: res.noCaben.map((it) => `${it.nombre} (${Math.round(Math.max(it.w, it.h))} × ${Math.round(Math.min(it.w, it.h))} mm)`),
    aprovechamiento: res.hojas.length ? areaPiezas / (res.hojas.length * o.largo * o.ancho) : 0,
    piezas: items.length,
    trazos,
  }
}

// ---- números de trazo sencillo (7 segmentos) para etiquetar piezas ----
const SEG: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" }
function numero(txt: string, cx: number, cy: number, alto: number): Trazo[] {
  const w = alto * 0.55, paso = w * 1.45
  const x0 = cx - (paso * txt.length - (paso - w)) / 2, y0 = cy - alto / 2
  const out: Trazo[] = []
  ;[...txt].forEach((ch, i) => {
    const x = x0 + i * paso
    const pt: Record<string, [P, P]> = {
      a: [[x, y0 + alto], [x + w, y0 + alto]],
      b: [[x + w, y0 + alto], [x + w, y0 + alto / 2]],
      c: [[x + w, y0 + alto / 2], [x + w, y0]],
      d: [[x, y0], [x + w, y0]],
      e: [[x, y0], [x, y0 + alto / 2]],
      f: [[x, y0 + alto / 2], [x, y0 + alto]],
      g: [[x, y0 + alto / 2], [x + w, y0 + alto / 2]],
    }
    for (const sg of SEG[ch] || "") out.push({ pts: pt[sg], cerrado: false, capa: "ETIQUETA" })
  })
  return out
}

// Lista de corte en CSV (para el taller o la cotización)
export function listaCorteCSV(piezas: { nombre: string; largo: number; ancho: number; grosor: number; cantidad: number; veta: Veta; numeros: number[]; material?: string; hojas?: string; canto?: { l1: boolean; l2: boolean; a1: boolean; a2: boolean; grosor: number } }[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  // canto por orilla: L1 y L2 son las orillas largas, A1 y A2 las cortas; la medida de corte descuenta el canto
  const filas = [["Números", "Pieza", "Material", "Largo (mm)", "Ancho (mm)", "Grosor (mm)", "Cantidad", "Veta", "Canto L1", "Canto L2", "Canto A1", "Canto A2", "Corte largo (mm)", "Corte ancho (mm)"].map(esc).join(",")]
  for (const p of piezas) {
    const c = p.canto
    const g = c?.grosor || 0
    const corteL = p.largo - (c ? ((c.a1 ? 1 : 0) + (c.a2 ? 1 : 0)) * g : 0)
    const corteA = p.ancho - (c ? ((c.l1 ? 1 : 0) + (c.l2 ? 1 : 0)) * g : 0)
    const si = (b?: boolean) => (b ? `${g} mm` : "")
    filas.push([p.numeros.join(" "), p.nombre, p.material || "", String(Math.round(p.largo)), String(Math.round(p.ancho)), String(Math.round(p.grosor * 10) / 10), String(p.cantidad), p.veta === "libre" ? "Sin veta" : p.veta === "largo" ? "A lo largo" : "Atravesada", si(c?.l1), si(c?.l2), si(c?.a1), si(c?.a2), String(Math.round(corteL * 10) / 10), String(Math.round(corteA * 10) / 10)].map(esc).join(","))
  }
  return filas.join("\n") + "\n"
}
