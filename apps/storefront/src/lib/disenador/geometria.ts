// Diseñador de vectores del CAM Studio: el modelo y la geometría (sin pantalla).
//
// Todo en milímetros con Y hacia arriba (como en CAD y en el CAM 2D).
// Una forma es una ruta de nodos; cada nodo puede llevar dos manijas de curva
// Bézier ("a" la que entra y "b" la que sale, en coordenadas absolutas). Sin
// manijas el tramo es recto. Rectángulos, círculos, estrellas y texto se guardan
// también como rutas, así todo se edita igual.
//
// Las operaciones de soldar, restar, intersectar y offset trabajan con la forma
// aplanada (tramos rectos de 0.02 mm de error, lo mismo que usa el CAM).
import ClipperLib from "clipper-lib"

import type { Dibujo, Trazo } from "@/lib/generador/vectores"

export type P = [number, number]
export type Nodo = { p: P; a?: P; b?: P }
export type Forma = { id: string; nodos: Nodo[]; cerrada: boolean; capa: string; grupo?: string }
export type Capa = { id: string; nombre: string; color: string; visible: boolean; maquinar: boolean }
export type Hoja = { ancho: number; alto: number; espesor: number }
export type Documento = { version: 1; nombre: string; formas: Forma[]; capas: Capa[]; hoja: Hoja; unidades: "mm" | "in" }
export type Caja = { x0: number; y0: number; x1: number; y1: number }

export const TOL = 0.02
const K = 0.5522847498 // manija de un cuarto de círculo

// Capas de inicio: el CAM 2D les asigna operación por nombre
export const CAPAS_BASE: Capa[] = [
  { id: "corte", nombre: "Corte (perfil)", color: "#F07A1A", visible: true, maquinar: true },
  { id: "cajeado", nombre: "Cajeado", color: "#3B82F6", visible: true, maquinar: true },
  { id: "grabado", nombre: "Grabado", color: "#22C55E", visible: true, maquinar: true },
  { id: "barrenos", nombre: "Barrenos", color: "#E11D48", visible: true, maquinar: true },
  { id: "guia", nombre: "Guía (no se maquina)", color: "#94A3B8", visible: true, maquinar: false },
]

export const documentoNuevo = (): Documento => ({
  version: 1,
  nombre: "Diseño",
  formas: [],
  capas: CAPAS_BASE.map((c) => ({ ...c })),
  hoja: { ancho: 600, alto: 400, espesor: 18 },
  unidades: "mm",
})

let cuenta = 0
export const nuevoId = () => `f${Date.now().toString(36)}${(cuenta++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

const forma = (nodos: Nodo[], cerrada: boolean, capa = "corte"): Forma => ({ id: nuevoId(), nodos, cerrada, capa })
const copiaP = (p?: P): P | undefined => (p ? [p[0], p[1]] : undefined)
export const copiaNodo = (n: Nodo): Nodo => ({ p: [n.p[0], n.p[1]], ...(n.a ? { a: copiaP(n.a) } : {}), ...(n.b ? { b: copiaP(n.b) } : {}) })
export const copiaForma = (f: Forma, nuevo = false): Forma => ({ ...f, id: nuevo ? nuevoId() : f.id, nodos: f.nodos.map(copiaNodo) })

// ---------------------------------------------------------------------
// Figuras
// ---------------------------------------------------------------------

export function linea(pts: P[], cerrada = false, capa?: string): Forma {
  return forma(
    pts.map((p) => ({ p: [p[0], p[1]] })),
    cerrada,
    capa
  )
}

/** Rectángulo desde una esquina, con radio en las esquinas. */
export function rectangulo(x: number, y: number, ancho: number, alto: number, radio = 0, capa?: string): Forma {
  const x0 = Math.min(x, x + ancho), y0 = Math.min(y, y + alto)
  const w = Math.abs(ancho), h = Math.abs(alto)
  const r = Math.max(0, Math.min(radio, w / 2, h / 2))
  if (r < 1e-6)
    return linea(
      [
        [x0, y0],
        [x0 + w, y0],
        [x0 + w, y0 + h],
        [x0, y0 + h],
      ],
      true,
      capa
    )
  const k = r * K
  const x1 = x0 + w, y1 = y0 + h
  const n: Nodo[] = [
    { p: [x0 + r, y0], a: [x0 + r - k, y0] },
    { p: [x1 - r, y0], b: [x1 - r + k, y0] },
    { p: [x1, y0 + r], a: [x1, y0 + r - k] },
    { p: [x1, y1 - r], b: [x1, y1 - r + k] },
    { p: [x1 - r, y1], a: [x1 - r + k, y1] },
    { p: [x0 + r, y1], b: [x0 + r - k, y1] },
    { p: [x0, y1 - r], a: [x0, y1 - r + k] },
    { p: [x0, y0 + r], b: [x0, y0 + r - k] },
  ]
  return forma(n, true, capa)
}

export function elipse(cx: number, cy: number, rx: number, ry: number, capa?: string): Forma {
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const kx = rx * K, ky = ry * K
  return forma(
    [
      { p: [cx + rx, cy], a: [cx + rx, cy - ky], b: [cx + rx, cy + ky] },
      { p: [cx, cy + ry], a: [cx + kx, cy + ry], b: [cx - kx, cy + ry] },
      { p: [cx - rx, cy], a: [cx - rx, cy + ky], b: [cx - rx, cy - ky] },
      { p: [cx, cy - ry], a: [cx - kx, cy - ry], b: [cx + kx, cy - ry] },
    ],
    true,
    capa
  )
}

export const circulo = (cx: number, cy: number, r: number, capa?: string) => elipse(cx, cy, r, r, capa)

export function poligono(cx: number, cy: number, r: number, lados: number, giro = Math.PI / 2, capa?: string): Forma {
  const n = Math.max(3, Math.round(lados))
  const pts: P[] = []
  for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos(giro + (i * 2 * Math.PI) / n), cy + r * Math.sin(giro + (i * 2 * Math.PI) / n)])
  return linea(pts, true, capa)
}

export function estrella(cx: number, cy: number, rExt: number, rInt: number, puntas: number, giro = Math.PI / 2, capa?: string): Forma {
  const n = Math.max(3, Math.round(puntas))
  const pts: P[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rInt : rExt
    const a = giro + (i * Math.PI) / n
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return linea(pts, true, capa)
}

/** Arco de circunferencia (abierto) de a0 a a1, en radianes, en sentido antihorario. */
export function arco(cx: number, cy: number, r: number, a0: number, a1: number, capa?: string): Forma {
  let barrido = a1 - a0
  while (barrido <= 0) barrido += Math.PI * 2
  const partes = Math.max(1, Math.ceil(barrido / (Math.PI / 2) - 1e-9))
  const d = barrido / partes
  const k = (4 / 3) * Math.tan(d / 4) * r
  const nodos: Nodo[] = []
  for (let i = 0; i <= partes; i++) {
    const a = a0 + i * d
    const c = Math.cos(a), s = Math.sin(a)
    const p: P = [cx + r * c, cy + r * s]
    const t: P = [-s, c] // tangente
    const nodo: Nodo = { p }
    if (i > 0) nodo.a = [p[0] - t[0] * k, p[1] - t[1] * k]
    if (i < partes) nodo.b = [p[0] + t[0] * k, p[1] + t[1] * k]
    nodos.push(nodo)
  }
  return forma(nodos, false, capa)
}

/** Circunferencia que pasa por tres puntos (null si están alineados). */
export function circuloPor3(p1: P, p2: P, p3: P): { c: P; r: number } | null {
  const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1]
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-9) return null
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
  return { c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) }
}

/** Arco de inicio a fin que pasa por "paso". */
export function arco3Puntos(inicio: P, fin: P, paso: P, capa?: string): Forma | null {
  const c = circuloPor3(inicio, paso, fin)
  if (!c) return null
  const ang = (p: P) => Math.atan2(p[1] - c.c[1], p[0] - c.c[0])
  const a0 = ang(inicio), a1 = ang(fin), am = ang(paso)
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  // antihorario de inicio a fin: ¿pasa por el punto de paso?
  const antihorario = norm(am - a0) < norm(a1 - a0)
  return antihorario ? arco(c.c[0], c.c[1], c.r, a0, a1, capa) : invertir(arco(c.c[0], c.c[1], c.r, a1, a0, capa))
}

/** Misma forma recorrida al revés. */
export function invertir(f: Forma): Forma {
  return { ...f, nodos: f.nodos.slice().reverse().map((n) => ({ p: [n.p[0], n.p[1]], ...(n.b ? { a: copiaP(n.b) } : {}), ...(n.a ? { b: copiaP(n.a) } : {}) })) }
}

// ---------------------------------------------------------------------
// Aplanar (curvas → tramos rectos) y medidas
// ---------------------------------------------------------------------

export type Tramo = { p0: P; c1?: P; c2?: P; p1: P }

/** Tramos de la forma (rectos o cúbicos). */
export function tramos(f: Forma): Tramo[] {
  const n = f.nodos
  const out: Tramo[] = []
  const total = f.cerrada ? n.length : n.length - 1
  for (let i = 0; i < total; i++) {
    const A = n[i], B = n[(i + 1) % n.length]
    if (A.b || B.a) out.push({ p0: A.p, c1: A.b || A.p, c2: B.a || B.p, p1: B.p })
    else out.push({ p0: A.p, p1: B.p })
  }
  return out
}

export function puntoCubica(t: Tramo, u: number): P {
  if (!t.c1 || !t.c2) return [t.p0[0] + (t.p1[0] - t.p0[0]) * u, t.p0[1] + (t.p1[1] - t.p0[1]) * u]
  const m = 1 - u
  const a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u
  return [a * t.p0[0] + b * t.c1[0] + c * t.c2[0] + d * t.p1[0], a * t.p0[1] + b * t.c1[1] + c * t.c2[1] + d * t.p1[1]]
}

function pasosCubica(t: Tramo, tol: number) {
  // cota del error de la cuerda con la segunda diferencia de los puntos de control
  const dd = Math.max(
    Math.hypot(t.p0[0] - 2 * t.c1![0] + t.c2![0], t.p0[1] - 2 * t.c1![1] + t.c2![1]),
    Math.hypot(t.c1![0] - 2 * t.c2![0] + t.p1[0], t.c1![1] - 2 * t.c2![1] + t.p1[1])
  )
  return Math.min(400, Math.max(1, Math.ceil(Math.sqrt((0.75 * dd) / tol))))
}

/** Puntos de la forma con curvas convertidas en tramos rectos (sin repetir el primero al cerrar). */
export function aplanar(f: Forma, tol = TOL): P[] {
  if (!f.nodos.length) return []
  const out: P[] = [[f.nodos[0].p[0], f.nodos[0].p[1]]]
  const ts = tramos(f)
  ts.forEach((t, i) => {
    const ultimo = f.cerrada && i === ts.length - 1
    if (!t.c1) {
      if (!ultimo) out.push([t.p1[0], t.p1[1]])
      return
    }
    const n = pasosCubica(t, tol)
    for (let k = 1; k <= n; k++) {
      if (ultimo && k === n) break
      out.push(puntoCubica(t, k / n))
    }
  })
  return out
}

export function cajaDe(formas: Forma[]): Caja | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const f of formas)
    for (const [x, y] of aplanar(f, 0.05)) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
}

export function areaPts(pts: P[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]
    s += x0 * y1 - x1 * y0
  }
  return s / 2
}

export function largo(f: Forma) {
  const pts = aplanar(f)
  let s = 0
  for (let i = 1; i < pts.length + (f.cerrada ? 1 : 0); i++) {
    const a = pts[i - 1], b = pts[i % pts.length]
    s += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return s
}

export function puntoEnPoligono(p: P, pol: P[]) {
  let dentro = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

export function distSegmento(p: P, a: P, b: P) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Distancia del punto a la línea de la forma (0 si está dentro de una forma cerrada y "relleno"). */
export function distanciaAForma(p: P, f: Forma, relleno = false) {
  const pts = aplanar(f, 0.1)
  if (relleno && f.cerrada && pts.length > 2 && puntoEnPoligono(p, pts)) return 0
  let d = Infinity
  for (let i = 1; i < pts.length + (f.cerrada ? 1 : 0); i++) d = Math.min(d, distSegmento(p, pts[i - 1], pts[i % pts.length]))
  if (pts.length === 1) d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1])
  return d
}

// ---------------------------------------------------------------------
// Transformar
// ---------------------------------------------------------------------

export function transformar(f: Forma, fn: (p: P) => P): Forma {
  return { ...f, nodos: f.nodos.map((n) => ({ p: fn(n.p), ...(n.a ? { a: fn(n.a) } : {}), ...(n.b ? { b: fn(n.b) } : {}) })) }
}

export const mover = (f: Forma, dx: number, dy: number) => transformar(f, ([x, y]) => [x + dx, y + dy])

export const escalar = (f: Forma, kx: number, ky: number, c: P) => {
  const g = transformar(f, ([x, y]) => [c[0] + (x - c[0]) * kx, c[1] + (y - c[1]) * ky])
  // escala negativa en un solo eje voltea el sentido de giro: se conserva
  return kx * ky < 0 ? invertir(g) : g
}

export const girar = (f: Forma, ang: number, c: P) => {
  const co = Math.cos(ang), s = Math.sin(ang)
  return transformar(f, ([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * s, c[1] + (x - c[0]) * s + (y - c[1]) * co])
}

export const espejo = (f: Forma, eje: "h" | "v", c: P) => (eje === "h" ? escalar(f, -1, 1, c) : escalar(f, 1, -1, c))

export const centro = (c: Caja): P => [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]

/** Ajusta la selección a una posición y medida (esquina de abajo a la izquierda). */
export function ajustarCaja(formas: Forma[], destino: { x?: number; y?: number; ancho?: number; alto?: number }, proporcional: boolean): Forma[] {
  const c = cajaDe(formas)
  if (!c) return formas
  const w = c.x1 - c.x0, h = c.y1 - c.y0
  let kx = destino.ancho !== undefined && w > 1e-9 ? destino.ancho / w : 1
  let ky = destino.alto !== undefined && h > 1e-9 ? destino.alto / h : 1
  if (proporcional) {
    if (destino.ancho !== undefined && destino.alto === undefined) ky = kx
    else if (destino.alto !== undefined && destino.ancho === undefined) kx = ky
  }
  if (!(kx > 0) || !(ky > 0)) return formas
  const base: P = [c.x0, c.y0]
  const nx = destino.x ?? c.x0, ny = destino.y ?? c.y0
  return formas.map((f) => mover(escalar(f, kx, ky, base), nx - c.x0, ny - c.y0))
}

export type Alineacion = "izq" | "centroH" | "der" | "arriba" | "centroV" | "abajo"

/** Alinea cada forma (o grupo) con la caja de referencia. */
export function alinear(formas: Forma[], modo: Alineacion, ref: Caja): Forma[] {
  const bloques = agruparPorGrupo(formas)
  const out: Forma[] = []
  for (const b of bloques) {
    const c = cajaDe(b)
    if (!c) {
      out.push(...b)
      continue
    }
    let dx = 0, dy = 0
    if (modo === "izq") dx = ref.x0 - c.x0
    if (modo === "der") dx = ref.x1 - c.x1
    if (modo === "centroH") dx = (ref.x0 + ref.x1) / 2 - (c.x0 + c.x1) / 2
    if (modo === "abajo") dy = ref.y0 - c.y0
    if (modo === "arriba") dy = ref.y1 - c.y1
    if (modo === "centroV") dy = (ref.y0 + ref.y1) / 2 - (c.y0 + c.y1) / 2
    out.push(...b.map((f) => mover(f, dx, dy)))
  }
  return out
}

function agruparPorGrupo(formas: Forma[]): Forma[][] {
  const grupos = new Map<string, Forma[]>()
  const sueltas: Forma[][] = []
  for (const f of formas) {
    if (!f.grupo) sueltas.push([f])
    else {
      if (!grupos.has(f.grupo)) grupos.set(f.grupo, [])
      grupos.get(f.grupo)!.push(f)
    }
  }
  return [...sueltas, ...grupos.values()]
}

/** Copias en fila: n copias (sin contar la original) separadas dx, dy. */
export function arregloLineal(formas: Forma[], n: number, dx: number, dy: number): Forma[] {
  const out: Forma[] = []
  const copias = Math.min(500, Math.max(0, Math.round(n)))
  for (let i = 1; i <= copias; i++) {
    const g = nuevoId()
    out.push(...formas.map((f) => ({ ...mover(copiaForma(f, true), dx * i, dy * i), ...(f.grupo ? { grupo: `${f.grupo}-${g}` } : {}) })))
  }
  return out
}

/** Copias alrededor de un centro: total de piezas en el ángulo dado (360 = vuelta completa). */
export function arregloCircular(formas: Forma[], total: number, c: P, anguloGrados = 360): Forma[] {
  const n = Math.min(500, Math.max(2, Math.round(total)))
  const completo = Math.abs(Math.abs(anguloGrados) - 360) < 1e-6
  const paso = ((anguloGrados * Math.PI) / 180) / (completo ? n : n - 1)
  const out: Forma[] = []
  for (let i = 1; i < n; i++) {
    const g = nuevoId()
    out.push(...formas.map((f) => ({ ...girar(copiaForma(f, true), paso * i, c), ...(f.grupo ? { grupo: `${f.grupo}-${g}` } : {}) })))
  }
  return out
}

// ---------------------------------------------------------------------
// Nodos
// ---------------------------------------------------------------------

/** Parte un tramo en u (de Casteljau) e inserta el nodo nuevo. */
export function insertarNodo(f: Forma, tramo: number, u: number): Forma {
  const n = f.nodos.map(copiaNodo)
  const i = tramo, j = (tramo + 1) % n.length
  const A = n[i], B = n[j]
  if (!A.b && !B.a) {
    const p: P = [A.p[0] + (B.p[0] - A.p[0]) * u, A.p[1] + (B.p[1] - A.p[1]) * u]
    n.splice(i + 1, 0, { p })
    return { ...f, nodos: n }
  }
  const p0 = A.p, p1 = A.b || A.p, p2 = B.a || B.p, p3 = B.p
  const l = (a: P, b: P): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
  const q0 = l(p0, p1), q1 = l(p1, p2), q2 = l(p2, p3)
  const r0 = l(q0, q1), r1 = l(q1, q2)
  const s = l(r0, r1)
  A.b = q0
  B.a = q2
  n.splice(i + 1, 0, { p: s, a: r0, b: r1 })
  return { ...f, nodos: n }
}

/** El punto más cercano de la forma: tramo y parámetro (para insertar un nodo). */
export function puntoMasCercano(f: Forma, p: P): { tramo: number; u: number; d: number } {
  let mejor = { tramo: 0, u: 0, d: Infinity }
  tramos(f).forEach((t, i) => {
    const pasos = t.c1 ? 60 : 1
    let prev = t.p0
    for (let k = 1; k <= pasos; k++) {
      const q = puntoCubica(t, k / pasos)
      const dx = q[0] - prev[0], dy = q[1] - prev[1]
      const L = dx * dx + dy * dy
      const w = L ? Math.max(0, Math.min(1, ((p[0] - prev[0]) * dx + (p[1] - prev[1]) * dy) / L)) : 0
      const d = Math.hypot(p[0] - (prev[0] + w * dx), p[1] - (prev[1] + w * dy))
      if (d < mejor.d) mejor = { tramo: i, u: (k - 1 + w) / pasos, d }
      prev = q
    }
  })
  return mejor
}

export function borrarNodo(f: Forma, i: number): Forma | null {
  if (f.nodos.length <= (f.cerrada ? 3 : 2)) return null
  return { ...f, nodos: f.nodos.filter((_, k) => k !== i).map(copiaNodo) }
}

/** Nodo suave: manijas alineadas con la dirección de sus vecinos. */
export function suavizarNodo(f: Forma, i: number): Forma {
  const n = f.nodos.map(copiaNodo)
  const N = n.length
  const prev = i > 0 ? n[i - 1] : f.cerrada ? n[N - 1] : null
  const next = i < N - 1 ? n[i + 1] : f.cerrada ? n[0] : null
  const p = n[i].p
  const ref0 = prev ? prev.p : p, ref1 = next ? next.p : p
  let tx = ref1[0] - ref0[0], ty = ref1[1] - ref0[1]
  const L = Math.hypot(tx, ty) || 1
  tx /= L
  ty /= L
  const d0 = prev ? Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]) / 3 : 0
  const d1 = next ? Math.hypot(next.p[0] - p[0], next.p[1] - p[1]) / 3 : 0
  n[i] = { p, ...(prev ? { a: [p[0] - tx * d0, p[1] - ty * d0] as P } : {}), ...(next ? { b: [p[0] + tx * d1, p[1] + ty * d1] as P } : {}) }
  return { ...f, nodos: n }
}

export function esquinaNodo(f: Forma, i: number): Forma {
  return { ...f, nodos: f.nodos.map((n, k) => (k === i ? { p: [n.p[0], n.p[1]] } : copiaNodo(n))) }
}

/** Abre una forma cerrada en el nodo i, o parte una abierta en dos. */
export function partirEnNodo(f: Forma, i: number): Forma[] {
  const n = f.nodos.map(copiaNodo)
  if (f.cerrada) {
    const rot = [...n.slice(i), ...n.slice(0, i), copiaNodo(n[i])]
    rot[0] = { ...rot[0] }
    delete rot[0].a
    delete rot[rot.length - 1].b
    return [{ ...f, nodos: rot, cerrada: false }]
  }
  if (i <= 0 || i >= n.length - 1) return [f]
  const a = n.slice(0, i + 1).map(copiaNodo), b = n.slice(i).map(copiaNodo)
  delete a[a.length - 1].b
  delete b[0].a
  return [
    { ...f, nodos: a },
    { ...f, id: nuevoId(), nodos: b },
  ]
}

/** Une rutas abiertas cuyos extremos se tocan (a menos de tol) y cierra las que regresan al inicio. */
export function unirAbiertas(formas: Forma[], tol = 0.05): Forma[] {
  const abiertas = formas.filter((f) => !f.cerrada).map((f) => copiaForma(f))
  const resto = formas.filter((f) => f.cerrada)
  const cerca = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol
  let cambio = true
  while (cambio) {
    cambio = false
    for (let i = 0; i < abiertas.length && !cambio; i++)
      for (let j = 0; j < abiertas.length && !cambio; j++) {
        if (i === j) continue
        let A = abiertas[i], B = abiertas[j]
        const a0 = A.nodos[0].p, a1 = A.nodos[A.nodos.length - 1].p
        const b0 = B.nodos[0].p, b1 = B.nodos[B.nodos.length - 1].p
        if (cerca(a1, b1)) B = invertir(B)
        else if (cerca(a0, b0)) A = invertir(A)
        else if (cerca(a0, b1)) {
          const t = A
          A = B
          B = t
        } else if (!cerca(a1, b0)) continue
        const ultimo = A.nodos[A.nodos.length - 1]
        const nodos = [...A.nodos.slice(0, -1), { ...ultimo, ...(B.nodos[0].b ? { b: B.nodos[0].b } : {}) }, ...B.nodos.slice(1)]
        const unido: Forma = { ...abiertas[i], nodos }
        abiertas.splice(Math.max(i, j), 1)
        abiertas.splice(Math.min(i, j), 1, unido)
        cambio = true
      }
  }
  for (const f of abiertas) {
    const n = f.nodos
    if (n.length > 2 && cerca(n[0].p, n[n.length - 1].p)) {
      const ult = n.pop()!
      if (ult.a) n[0] = { ...n[0], a: ult.a }
      f.cerrada = true
    }
  }
  return [...resto, ...abiertas]
}

// ---------------------------------------------------------------------
// Soldar, restar, intersectar, offset (Clipper)
// ---------------------------------------------------------------------

const ESC = 1000
type IP = { X: number; Y: number }
const aClip = (pts: P[]): IP[] => pts.map(([x, y]) => ({ X: Math.round(x * ESC), Y: Math.round(y * ESC) }))
const deClip = (pts: IP[]): P[] => pts.map((q) => [q.X / ESC, q.Y / ESC])

function poligonosDe(formas: Forma[]): IP[][] {
  return formas.filter((f) => f.cerrada && f.nodos.length >= 2).map((f) => aClip(aplanar(f))).filter((p) => p.length >= 3)
}

function aFormas(polys: IP[][], capa: string): Forma[] {
  return ClipperLib.Clipper.CleanPolygons(polys, 0.002 * ESC)
    .filter((p: IP[]) => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) > 0.0005 * ESC * ESC)
    .map((p: IP[]) => linea(simplificar(deClip(p), 0.005), true, capa))
}

/** Quita puntos alineados (deja las curvas aplanadas con menos nodos). */
export function simplificar(pts: P[], tol: number): P[] {
  if (pts.length < 4) return pts
  const out: P[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = out.length ? out[out.length - 1] : pts[pts.length - 1]
    const b = pts[i], c = pts[(i + 1) % pts.length]
    if (distSegmento(b, a, c) > tol) out.push(b)
  }
  return out.length >= 3 ? out : pts
}

function operar(sujetos: IP[][], recortes: IP[][], tipo: number): IP[][] {
  const c = new ClipperLib.Clipper()
  c.AddPaths(sujetos, ClipperLib.PolyType.ptSubject, true)
  if (recortes.length) c.AddPaths(recortes, ClipperLib.PolyType.ptClip, true)
  const sol: IP[][] = []
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return sol
}

/** Suelda (une) las formas cerradas en una o varias. */
export function soldar(formas: Forma[]): Forma[] {
  const capa = formas[0]?.capa || "corte"
  return aFormas(operar(poligonosDe(formas), [], ClipperLib.ClipType.ctUnion), capa)
}

/** A la primera forma (la de abajo o la primera elegida) le quita las demás. */
export function restar(base: Forma[], quitar: Forma[]): Forma[] {
  const capa = base[0]?.capa || "corte"
  return aFormas(operar(poligonosDe(base), poligonosDe(quitar), ClipperLib.ClipType.ctDifference), capa)
}

/** Lo que tienen en común todas las formas. */
export function intersectar(formas: Forma[]): Forma[] {
  if (formas.length < 2) return []
  const capa = formas[0].capa
  let acc = poligonosDe([formas[0]])
  for (const f of formas.slice(1)) acc = operar(acc, poligonosDe([f]), ClipperLib.ClipType.ctIntersection)
  return aFormas(acc, capa)
}

/** Contorno paralelo a "d" mm (positivo afuera, negativo adentro). Rutas abiertas: contorno alrededor. */
export function offset(formas: Forma[], d: number, esquinas: "redondas" | "rectas" = "redondas"): Forma[] {
  if (!d) return []
  const co = new ClipperLib.ClipperOffset(2, 0.01 * ESC)
  co.ArcTolerance = TOL * ESC
  const jt = esquinas === "redondas" ? ClipperLib.JoinType.jtRound : ClipperLib.JoinType.jtMiter
  const cerradas = formas.filter((f) => f.cerrada)
  const abiertas = formas.filter((f) => !f.cerrada)
  if (cerradas.length) {
    // unidas primero: así las formas dentro de otras quedan como huecos y el offset va al lado correcto
    const base = operar(poligonosDe(cerradas), [], ClipperLib.ClipType.ctUnion)
    co.AddPaths(base, jt, ClipperLib.EndType.etClosedPolygon)
  }
  if (abiertas.length) co.AddPaths(abiertas.map((f) => aClip(aplanar(f))), jt, esquinas === "redondas" ? ClipperLib.EndType.etOpenRound : ClipperLib.EndType.etOpenButt)
  const sol: IP[][] = []
  co.Execute(sol, abiertas.length && !cerradas.length ? Math.abs(d) * ESC : d * ESC)
  return aFormas(sol, formas[0]?.capa || "corte")
}

/** Redondea las esquinas rectas (nodos sin manijas) con radio r. */
export function redondearEsquinas(f: Forma, r: number): Forma {
  if (!(r > 0)) return f
  const n = f.nodos
  const N = n.length
  const out: Nodo[] = []
  for (let i = 0; i < N; i++) {
    const cur = n[i]
    const tieneVecinos = f.cerrada || (i > 0 && i < N - 1)
    if (cur.a || cur.b || !tieneVecinos) {
      out.push(copiaNodo(cur))
      continue
    }
    const prev = n[(i - 1 + N) % N], next = n[(i + 1) % N]
    if (prev.b || next.a) {
      out.push(copiaNodo(cur))
      continue
    }
    const v1: P = [prev.p[0] - cur.p[0], prev.p[1] - cur.p[1]]
    const v2: P = [next.p[0] - cur.p[0], next.p[1] - cur.p[1]]
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2)
    if (l1 < 1e-9 || l2 < 1e-9) {
      out.push(copiaNodo(cur))
      continue
    }
    const u1: P = [v1[0] / l1, v1[1] / l1], u2: P = [v2[0] / l2, v2[1] / l2]
    const cosT = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))
    const theta = Math.acos(cosT) // ángulo interior de la esquina
    if (theta < 1e-3 || Math.PI - theta < 1e-3) {
      out.push(copiaNodo(cur))
      continue
    }
    // distancia de la esquina al punto de tangencia; sin pasar de la mitad de cada lado
    let t = r / Math.tan(theta / 2)
    t = Math.min(t, l1 / 2, l2 / 2)
    const rr = t * Math.tan(theta / 2)
    const barrido = Math.PI - theta
    const k = (4 / 3) * Math.tan(barrido / 4) * rr
    const pA: P = [cur.p[0] + u1[0] * t, cur.p[1] + u1[1] * t]
    const pB: P = [cur.p[0] + u2[0] * t, cur.p[1] + u2[1] * t]
    out.push({ p: pA, b: [pA[0] - u1[0] * k, pA[1] - u1[1] * k] })
    out.push({ p: pB, a: [pB[0] - u2[0] * k, pB[1] - u2[1] * k] })
  }
  return { ...f, nodos: out }
}

// ---------------------------------------------------------------------
// Entrada y salida
// ---------------------------------------------------------------------

/** Trazos de un DXF o SVG (o de un generador) → formas en el diseño. */
export function desdeTrazos(trazos: Trazo[], capaPorOmision = "corte", capasConocidas: string[] = []): Forma[] {
  return trazos
    .filter((t) => t.pts.length >= 2)
    .map((t) => {
      const capa = capasConocidas.includes(t.capa) ? t.capa : capaPorOmision
      const pts = t.cerrado ? simplificar(t.pts, 0.002) : t.pts
      return linea(pts as P[], t.cerrado, capa)
    })
}

/** Lo que se maquina, como dibujo para el CAM 2D o el DXF (capas visibles y que se maquinan). */
export function aDibujo(doc: Pick<Documento, "formas" | "capas">): Dibujo {
  const maquinar = new Set(doc.capas.filter((c) => c.maquinar && c.visible).map((c) => c.id))
  const trazos: Trazo[] = doc.formas
    .filter((f) => maquinar.has(f.capa) && f.nodos.length >= 2)
    .map((f) => ({ pts: aplanar(f), cerrado: f.cerrada, capa: f.capa }))
  return { trazos, avisos: [], unidades: "mm" }
}

/** Ruta SVG (para la pantalla) en coordenadas del mundo; la vista invierte Y. */
export function rutaSVG(f: Forma): string {
  const n = f.nodos
  if (!n.length) return ""
  const r = (x: number) => Math.round(x * 1000) / 1000
  let d = `M${r(n[0].p[0])} ${r(n[0].p[1])}`
  for (const t of tramos(f)) d += t.c1 ? `C${r(t.c1[0])} ${r(t.c1[1])} ${r(t.c2![0])} ${r(t.c2![1])} ${r(t.p1[0])} ${r(t.p1[1])}` : `L${r(t.p1[0])} ${r(t.p1[1])}`
  return f.cerrada ? `${d}Z` : d
}

/** Revisa un documento leído (de este navegador o de un proyecto guardado). */
export function documentoValido(x: unknown): Documento | null {
  const d = x as Documento
  if (!d || d.version !== 1 || !Array.isArray(d.formas) || !Array.isArray(d.capas) || !d.hoja) return null
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v)
  const pt = (p: unknown) => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1])
  const formas = d.formas.filter(
    (f) => f && typeof f.id === "string" && typeof f.capa === "string" && Array.isArray(f.nodos) && f.nodos.length && f.nodos.every((n) => n && pt(n.p) && (!n.a || pt(n.a)) && (!n.b || pt(n.b)))
  )
  const capas = d.capas.filter((c) => c && typeof c.id === "string" && typeof c.nombre === "string")
  if (!capas.length) return null
  return {
    version: 1,
    nombre: typeof d.nombre === "string" ? d.nombre.slice(0, 80) : "Diseño",
    formas,
    capas,
    hoja: { ancho: num(d.hoja.ancho) ? d.hoja.ancho : 600, alto: num(d.hoja.alto) ? d.hoja.alto : 400, espesor: num(d.hoja.espesor) ? d.hoja.espesor : 18 },
    unidades: d.unidades === "in" ? "in" : "mm",
  }
}
