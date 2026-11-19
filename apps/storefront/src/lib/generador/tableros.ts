// Cualquier mueble de tableros → piezas listas para maquilar (caja y espiga).
//
// Entra una lista de tableros como cajas a escala (la lee la IA de una imagen o
// la edita el cliente) y sale lo mismo que el exhibidor: el contorno real de
// cada pieza con sus espigas, las mortajas que recibe, alivios para la fresa y
// dónde va en el mueble armado. La vista 3D extruye esas mismas piezas.
//
// Cómo se arma:
//  1. Cada tablero tiene un eje delgado (su grosor): lateral = X, frontal = Y,
//     horizontal = Z. Se toma el eje más corto de la caja, diga lo que diga el
//     plano que venga escrito.
//  2. Uniones: el extremo de un tablero Q que llega a la cara de un tablero P
//     perpendicular (dentro de su área) se une a P. Si se metía o atravesaba a
//     P, se recorta a su cara. Si los dos se tocan en esquina, gana el que
//     llega de lleno a la cara del otro.
//  3. Medidas y grosor: los extremos unidos siguen a la cara del tablero al
//     que llegan, así que cambiar el grosor o escalar el mueble no abre huecos
//     ni encima piezas.
//  4. Q lleva espigas pasadas por P; P lleva mortajas. Si una mortaja queda
//     junto a la orilla de P, P crece lo necesario para que no se rompa.
//  5. Los tableros que no tocan al resto se quitan y se avisa.
//
// Límite: tableros planos a escuadra. Curvas o inclinaciones se aproximan.

import { type Herramienta, type Mueble, type P, type PiezaEnsamble, type Plano, type TipoAlivio, type TipoEsquina, aMueble, esquinasExteriores, exteriorConAlivios, mortaja } from "./ensamble"

// Abertura: hueco rectangular dentro de un tablero (pasacables, ventana, agarradera).
// En mm desde la esquina menor del tablero, sobre sus ejes (u, v): lateral (Y, Z),
// horizontal (X, Y), frontal (X, Z).
export type Abertura = { u0: number; v0: number; u1: number; v1: number }
export type Tablero = { nombre: string; plano?: Plano; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; aberturas?: Abertura[] }
// pieza con el índice del tablero de donde salió (para seleccionarla y editarla)
export type PiezaTablero = PiezaEnsamble & { origen: number; indice: number; barrenos: Barreno[]; cantos: BarrenoCanto[] }

// Cómo se unen las piezas: caja y espiga (sin tornillos, para router), o con
// herraje de carpintería: confirmat, minifix con taquetes, o sólo taquetes con
// pegamento. Con herraje las piezas van a tope y llevan sus barrenos marcados.
export type TipoUnion = "espiga" | "confirmat" | "minifix" | "taquete"
export const UNIONES: { id: TipoUnion; nombre: string; nota: string }[] = [
  { id: "espiga", nombre: "Caja y espiga", nota: "Sin tornillos ni herrajes" },
  { id: "confirmat", nombre: "Confirmat", nota: "Tornillo 7 × 50: rápido y firme" },
  { id: "minifix", nombre: "Minifix + taquete", nota: "Se arma y desarma: cocinas y closets" },
  { id: "taquete", nombre: "Taquete y pegamento", nota: "Unión fija, sin herraje visible" },
]
// barreno en una cara de la pieza (cara 0: w = 0, cara 1: w = grosor)
export type Barreno = { u: number; v: number; d: number; prof: number; cara: 0 | 1; tipo: string }
// barreno de canto (se hace a mano o con taladro horizontal): sale del punto (u, v) de la orilla hacia (du, dv)
export type BarrenoCanto = { u: number; v: number; du: number; dv: number; d: number; prof: number; tipo: string }

export type OpcionesTableros = {
  union?: TipoUnion
  ancho?: number // medidas totales deseadas (sin dato = las de la lectura)
  fondo?: number
  alto?: number
  grosor: number
  holgura: number
  saliente: number // cuánto sobresalen las espigas pasadas (0 = al ras)
  herramienta: Herramienta
  // varios muebles en un mismo diseño (una cocina): se conservan todos los grupos
  // de tableros unidos entre sí, no sólo el más grande
  varios?: boolean
  // esquinas interiores (mortajas y raíz de las espigas): cabeza de fémur, en T o sin alivio
  alivio?: TipoAlivio
  // esquinas exteriores de cada pieza: rectas, redondeadas o con chaflán (medida en mm)
  esquinas?: { tipo: TipoEsquina; medida: number }
  // espigas por unión (0 = automático) y ancho de cada espiga en mm (0 = automático)
  numEspigas?: number
  anchoEspiga?: number
}

export const TABLEROS_INICIO: Omit<OpcionesTableros, "ancho" | "fondo" | "alto"> = {
  grosor: 18,
  holgura: 0.3,
  saliente: 0,
  herramienta: { tipo: "fresa", diametro: 6.35 },
}

// tablerosFinales: los tableros ya armados (recortados, escalados y con su grosor),
// en el orden de las piezas: editar sobre ellos da el mismo mueble. sueltos: los que
// no tocan al resto (no se cortan; la vista 3D los muestra para corregirlos).
export type MuebleTableros = Omit<Mueble, "piezas"> & { piezas: PiezaTablero[]; tablerosFinales: Tablero[]; sueltos: Tablero[]; descartados: string[]; uniones: number; aTope: number; original: { ancho: number; fondo: number; alto: number } }

type Eje = 0 | 1 | 2
// ab: aberturas en coordenadas absolutas (u0, v0, u1, v1) sobre los ejes del tablero
type Caja = { nombre: string; k: Eje; lo: number[]; hi: number[]; origen: number; ab: number[][] }
// puntaje: qué tanto cae el grueso de Q dentro de P; borde: qué tanto de la orilla de Q cae en P
type Union = { q: number; A: Eje; s: 0 | 1; p: number; puntaje: number; borde: number }

const PLANO: Record<Eje, Plano> = { 0: "lateral", 1: "frontal", 2: "horizontal" }
// ejes (u, v) del plano de cada pieza, igual que aMueble()
const EJE_U: Record<Eje, Eje> = { 0: 1, 1: 0, 2: 0 }
const EJE_V: Record<Eje, Eje> = { 0: 2, 1: 2, 2: 1 }
const MAX_TABLEROS = 60
const traslape = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
const r1 = (v: number) => Math.round(v * 10) / 10

// distancia entre dos segmentos (x0, y0, x1, y1) en el plano
function distSegmentos(a: [number, number, number, number], b: [number, number, number, number]): number {
  const pt = (px: number, py: number, s: [number, number, number, number]) => {
    const dx = s[2] - s[0], dy = s[3] - s[1]
    const t = Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(px - s[0] - t * dx, py - s[1] - t * dy)
  }
  const o = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
  if (o(a[0], a[1], a[2], a[3], b[0], b[1]) * o(a[0], a[1], a[2], a[3], b[2], b[3]) < 0 && o(b[0], b[1], b[2], b[3], a[0], a[1]) * o(b[0], b[1], b[2], b[3], a[2], a[3]) < 0) return 0
  return Math.min(pt(a[0], a[1], b), pt(a[2], a[3], b), pt(b[0], b[1], a), pt(b[2], b[3], a))
}

function circuloPts(cu: number, cv: number, r: number, n = 24): P[] {
  return Array.from({ length: n }, (_, i) => [cu + r * Math.cos((2 * Math.PI * i) / n), cv + r * Math.sin((2 * Math.PI * i) / n)] as P)
}

function aTablero(c: Caja): Tablero {
  const U = EJE_U[c.k], V = EJE_V[c.k]
  const t: Tablero = { nombre: c.nombre, plano: PLANO[c.k], x0: r1(c.lo[0]), x1: r1(c.hi[0]), y0: r1(c.lo[1]), y1: r1(c.hi[1]), z0: r1(c.lo[2]), z1: r1(c.hi[2]) }
  // el grosor se guarda exacto para que volver a armar dé lo mismo
  if (c.k === 0) t.x1 = t.x0 + (c.hi[0] - c.lo[0])
  if (c.k === 1) t.y1 = t.y0 + (c.hi[1] - c.lo[1])
  if (c.k === 2) t.z1 = t.z0 + (c.hi[2] - c.lo[2])
  if (c.ab.length) t.aberturas = c.ab.map((h) => ({ u0: r1(h[0] - c.lo[U]), v0: r1(h[1] - c.lo[V]), u1: r1(h[2] - c.lo[U]), v1: r1(h[3] - c.lo[V]) }))
  return t
}

export function cajaDeTablero(t: Tablero) {
  return { lo: [Math.min(t.x0, t.x1), Math.min(t.y0, t.y1), Math.min(t.z0, t.z1)], hi: [Math.max(t.x0, t.x1), Math.max(t.y0, t.y1), Math.max(t.z0, t.z1)] }
}

// Las medidas que pide el cliente son las del mueble terminado (con lo que
// crecen las orillas y sobresalen las espigas): se arma una vez, se mide lo
// que sobra por eje y se vuelve a armar descontándolo.
export function muebleDeTableros(tableros: Tablero[], o: OpcionesTableros): MuebleTableros {
  let m = armar(tableros, o)
  const meta = [o.ancho, o.fondo, o.alto].map((v) => (v && Number.isFinite(v) ? Math.max(100, Math.min(3000, v)) : undefined))
  if (!meta.some((v) => v) || !m.piezas.length) return m
  let pedir = [...meta]
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const med = [m.medidas.ancho, m.medidas.fondo, m.medidas.alto]
    if (meta.every((v, i) => !v || Math.abs(med[i] - v) <= 1)) break
    pedir = pedir.map((v, i) => (v && meta[i] ? Math.max(100, v + (meta[i]! - med[i])) : undefined))
    m = armar(tableros, { ...o, ancho: pedir[0], fondo: pedir[1], alto: pedir[2] })
    if (!m.piezas.length) break
  }
  return m
}

function armar(tableros: Tablero[], o0: OpcionesTableros): MuebleTableros {
  const errores: string[] = []
  const avisos: string[] = []
  const descartados: string[] = []
  const acotar = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a)
  const e = acotar(o0.grosor, 6, 30)
  const tipoUnion: TipoUnion = o0.union && UNIONES.some((x) => x.id === o0.union) ? o0.union : "espiga"
  const holgura = acotar(o0.holgura, 0, 2)
  const saliente = acotar(o0.saliente, 0, 60)
  const cl = holgura / 2
  const r = o0.herramienta.tipo === "fresa" ? Math.max(0.5, o0.herramienta.diametro / 2) : 0
  const vacio = (msg: string): MuebleTableros => ({ piezas: [], compras: [], medidas: { ancho: 0, fondo: 0, alto: 0 }, errores: [msg], avisos, descartados, uniones: 0, aTope: 0, tablerosFinales: [], sueltos: [], original: { ancho: 0, fondo: 0, alto: 0 } })

  // ---- 1. limpiar la lectura ----
  const nombres = new Map<string, number>()
  let cajas: Caja[] = []
  const maxT = o0.varios ? 400 : MAX_TABLEROS
  for (const [origen, t] of tableros.slice(0, maxT).entries()) {
    const vals = [t.x0, t.x1, t.y0, t.y1, t.z0, t.z1]
    if (!vals.every((v) => Number.isFinite(v))) continue
    const { lo, hi } = cajaDeTablero({ ...t, x0: acotar(t.x0, -5000, 5000), x1: acotar(t.x1, -5000, 5000), y0: acotar(t.y0, -5000, 5000), y1: acotar(t.y1, -5000, 5000), z0: acotar(t.z0, -5000, 5000), z1: acotar(t.z1, -5000, 5000) })
    const ext = [0, 1, 2].map((i) => hi[i] - lo[i])
    const k = ext.indexOf(Math.min(...ext)) as Eje
    let nombre = (t.nombre || "Tablero").trim().slice(0, 40) || "Tablero"
    const n = (nombres.get(nombre) || 0) + 1
    nombres.set(nombre, n)
    if (n > 1) nombre = `${nombre} ${n}`
    const otros = ext.filter((_, i) => i !== k)
    if (Math.min(...otros) < 20) {
      descartados.push(`${nombre} (muy chico)`)
      continue
    }
    if (ext[k] > Math.max(60, 4 * e)) {
      descartados.push(`${nombre} (no es un tablero: mide ${Math.round(ext[k])} mm de grueso)`)
      continue
    }
    const U0 = EJE_U[k], V0 = EJE_V[k]
    const ab = (t.aberturas || [])
      .filter((a) => [a.u0, a.v0, a.u1, a.v1].every(Number.isFinite))
      .map((a) => [lo[U0] + Math.min(a.u0, a.u1), lo[V0] + Math.min(a.v0, a.v1), lo[U0] + Math.max(a.u0, a.u1), lo[V0] + Math.max(a.v0, a.v1)])
    cajas.push({ nombre, k, lo, hi, origen, ab })
  }
  // cruces: un tablero que atraviesa a otro perpendicular se parte en dos en sus
  // caras (cada mitad se une con espiga); se parte el vertical, o el más chico
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    let hecho = false
    for (let i = 0; i < cajas.length && !hecho; i++)
      for (let j = 0; j < cajas.length && !hecho; j++) {
        const X = cajas[i], Y = cajas[j]
        if (i === j || X.k === Y.k) continue
        const A = Y.k, B = X.k
        const C = (3 - A - B) as Eje
        const t = Math.max(10, 0.75 * e)
        const cruza = X.lo[A] < Y.lo[A] - t && X.hi[A] > Y.hi[A] + t && Y.lo[B] < X.lo[B] - t && Y.hi[B] > X.hi[B] + t && traslape(X.lo[C], X.hi[C], Y.lo[C], Y.hi[C]) >= 30
        if (!cruza) continue
        const area = (c: Caja) => [0, 1, 2].filter((k) => k !== c.k).reduce((a, k) => a * (c.hi[k] - c.lo[k]), 1)
        // se parte X si es vertical y Y horizontal, o si es el más chico; si no, en otra vuelta se parte Y
        if (!((X.k !== 2 && Y.k === 2) || (X.k !== 2 && Y.k !== 2 && area(X) <= area(Y)) || (X.k === 2 && Y.k === 2))) continue
        const a: Caja = { nombre: `${X.nombre} (1)`, k: X.k, lo: [...X.lo], hi: [...X.hi], origen: X.origen, ab: [] }
        const b: Caja = { nombre: `${X.nombre} (2)`, k: X.k, lo: [...X.lo], hi: [...X.hi], origen: X.origen, ab: [] }
        a.hi[A] = Y.lo[A]
        b.lo[A] = Y.hi[A]
        // cada abertura se queda en la mitad donde cae
        const enA = EJE_U[X.k] === A ? 0 : 1
        for (const h of X.ab) (h[enA + 2] <= Y.lo[A] ? a : b).ab.push(h)
        cajas.splice(i, 1, a, b)
        avisos.push(`${X.nombre} atravesaba a ${Y.nombre}: se partió en dos piezas que se unen a ${Y.nombre}.`)
        hecho = true
      }
    if (!hecho) break
  }
  if (tableros.length > maxT) avisos.push(`Sólo se usaron los primeros ${maxT} tableros.`)
  if (cajas.length < 2) return vacio("Hacen falta al menos dos tableros que se toquen.")

  const mn = [0, 1, 2].map((i) => Math.min(...cajas.map((c) => c.lo[i])))
  const mx = [0, 1, 2].map((i) => Math.max(...cajas.map((c) => c.hi[i])))
  const original = { ancho: Math.round(mx[0] - mn[0]), fondo: Math.round(mx[1] - mn[1]), alto: Math.round(mx[2] - mn[2]) }
  const g0 = cajas.map((c) => c.hi[c.k] - c.lo[c.k]).sort((a, b) => a - b)[Math.floor(cajas.length / 2)]
  const tol = Math.max(10, 0.75 * Math.max(g0, e))

  // ---- 2. uniones (sobre la lectura original) ----
  const buscarUniones = (cs: Caja[]): Union[] => {
    const us: Union[] = []
    cs.forEach((Q, q) => {
      for (const A of [0, 1, 2] as Eje[]) {
        if (A === Q.k) continue
        const B = Q.k
        const C = (3 - A - B) as Eje
        for (const s of [0, 1] as const) {
          const v = s === 0 ? Q.lo[A] : Q.hi[A]
          let mejor: Union | null = null
          let mejorDist = Infinity
          cs.forEach((Pc, p) => {
            if (p === q || Pc.k !== A) return
            if (v < Pc.lo[A] - tol || v > Pc.hi[A] + tol) return
            // el cuerpo de Q sigue del otro lado de P (no lo cruza ni se queda adentro)
            if (s === 0 ? Q.hi[A] <= Pc.hi[A] + 1 : Q.lo[A] >= Pc.lo[A] - 1) return
            const puntaje = traslape(Q.lo[B], Q.hi[B], Pc.lo[B], Pc.hi[B]) / Math.max(1e-6, Q.hi[B] - Q.lo[B])
            // si Q ya se mete en P basta con que se toquen un poco; si sólo se acerca, la mitad
            const penetra = s === 0 ? v < Pc.hi[A] - 1 : v > Pc.lo[A] + 1
            if (puntaje < (penetra ? 0.05 : 0.5)) return
            const enC = traslape(Q.lo[C], Q.hi[C], Pc.lo[C], Pc.hi[C])
            if (enC < 30) return
            const borde = enC / Math.max(1e-6, Q.hi[C] - Q.lo[C])
            const dist = s === 0 ? Math.abs(v - Pc.hi[A]) : Math.abs(v - Pc.lo[A])
            if (!mejor || puntaje > mejor.puntaje + 1e-6 || (Math.abs(puntaje - mejor.puntaje) < 1e-6 && dist < mejorDist)) {
              mejor = { q, A, s, p, puntaje, borde }
              mejorDist = dist
            }
          })
          if (mejor) us.push(mejor)
        }
      }
    })
    // esquinas: si Q llega a P y P llega a Q, se queda la que entra de lleno
    const fuera = new Set<Union>()
    for (const a of us)
      for (const b of us) {
        if (a === b || fuera.has(a) || fuera.has(b) || a.q !== b.p || a.p !== b.q) continue
        const qa = cs[a.q], qb = cs[b.q]
        // gana el que cae de lleno en el otro con más orilla dentro del otro
        const fa = a.puntaje * a.borde, fb = b.puntaje * b.borde
        const pierde =
          fa > fb + 0.05 ? b
          : fb > fa + 0.05 ? a
          : qa.k === 2 && qb.k !== 2 ? a
          : qb.k === 2 && qa.k !== 2 ? b
          : a.q > b.q ? a : b
        fuera.add(pierde)
      }
    return us.filter((u) => !fuera.has(u))
  }
  let uniones = buscarUniones(cajas)

  // ---- 3. quedarse con el mueble principal ----
  const padre = cajas.map((_, i) => i)
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])))
  for (const u of uniones) padre[raiz(u.q)] = raiz(u.p)
  const grupos = new Map<number, number[]>()
  cajas.forEach((_, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) || []), i]))
  const principal = o0.varios
    ? [...grupos.values()].filter((g) => g.length >= 2).flat().sort((a, b) => a - b)
    : [...grupos.values()].sort((a, b) => b.length - a.length)[0] || []
  if (principal.length < 2) return { ...vacio("Los tableros no se tocan entre sí: no se puede armar el mueble. Revisa sus medidas."), original }
  let fuera: Caja[] = []
  if (principal.length < cajas.length) {
    const queda = new Set(principal)
    fuera = cajas.filter((_, i) => !queda.has(i))
    cajas.forEach((c, i) => !queda.has(i) && descartados.push(`${c.nombre} (no toca al resto)`))
    const nuevo = new Map(principal.map((i, j) => [i, j]))
    uniones = uniones.filter((u) => queda.has(u.q) && queda.has(u.p)).map((u) => ({ ...u, q: nuevo.get(u.q)!, p: nuevo.get(u.p)! }))
    cajas = principal.map((i) => cajas[i])
  }

  // ---- 4. escalar y poner el grosor ----
  const mn2 = [0, 1, 2].map((i) => Math.min(...cajas.map((c) => c.lo[i])))
  const mx2 = [0, 1, 2].map((i) => Math.max(...cajas.map((c) => c.hi[i])))
  const meta = [o0.ancho, o0.fondo, o0.alto]
  const esc = [0, 1, 2].map((i) => {
    const ext = Math.max(1, mx2[i] - mn2[i])
    const m = meta[i]
    return m && Number.isFinite(m) ? acotar(m, 100, 3000) / ext : 1
  })
  const mapa = (i: number, t: number) => (t - mn2[i]) * esc[i]
  const unida = new Map<string, Union>()
  for (const u of uniones) unida.set(`${u.q}:${u.A}:${u.s}`, u)
  const fin: Caja[] = cajas.map((c) => {
    const lo = [0, 0, 0], hi = [0, 0, 0]
    const k = c.k
    let l: number
    if (Math.abs(c.lo[k] - mn2[k]) <= tol) l = 0
    else if (Math.abs(c.hi[k] - mx2[k]) <= tol) l = mapa(k, mx2[k]) - e
    else l = mapa(k, (c.lo[k] + c.hi[k]) / 2) - e / 2
    lo[k] = r1(l)
    hi[k] = lo[k] + e // exacto: las caras unidas deben coincidir con desfase + grosor
    const U1 = EJE_U[k], V1 = EJE_V[k]
    return { nombre: c.nombre, k, lo, hi, origen: c.origen, ab: c.ab.map((h) => [mapa(U1, h[0]), mapa(V1, h[1]), mapa(U1, h[2]), mapa(V1, h[3])]) }
  })
  cajas.forEach((c, q) => {
    for (const A of [0, 1, 2] as Eje[]) {
      if (A === c.k) continue
      for (const s of [0, 1] as const) {
        const u = unida.get(`${q}:${A}:${s}`)
        const v = u ? (s === 0 ? fin[u.p].hi[A] : fin[u.p].lo[A]) : r1(mapa(A, s === 0 ? c.lo[A] : c.hi[A]))
        if (s === 0) fin[q].lo[A] = v
        else fin[q].hi[A] = v
      }
    }
  })
  // ---- 4b. encimes que quedaron (lecturas sueltas, o al cambiar grosor o escala):
  // el tablero que se mete en otro perpendicular se recorta a su cara y se une
  const unidos = (a: number, b: number) => uniones.some((u) => (u.q === a && u.p === b) || (u.q === b && u.p === a))
  const encima = (a: Caja, b: Caja) => [0, 1, 2].every((i) => traslape(a.lo[i], a.hi[i], b.lo[i], b.hi[i]) > 0.05)
  for (let q = 0; q < fin.length; q++)
    for (let p = 0; p < fin.length; p++) {
      if (q === p || !encima(fin[q], fin[p]) || unidos(q, p)) continue
      const Q = fin[q], Pc = fin[p]
      if (Q.k === Pc.k) continue // se reporta abajo
      // opción 1: recortar Q contra P; opción 2: P contra Q. Se hace la que recorta menos.
      const recorte = (X: Caja, Y: Caja, ix: number) => {
        const A = Y.k
        if (X.hi[A] > Y.hi[A] && X.lo[A] < Y.hi[A] && !unida.has(`${ix}:${A}:0`)) return { s: 0 as const, A, cuanto: Y.hi[A] - X.lo[A] }
        if (X.lo[A] < Y.lo[A] && X.hi[A] > Y.lo[A] && !unida.has(`${ix}:${A}:1`)) return { s: 1 as const, A, cuanto: X.hi[A] - Y.lo[A] }
        return null
      }
      const r1q = recorte(Q, Pc, q), r1p = recorte(Pc, Q, p)
      // sólo se recorta un encime chico (una punta que se mete); uno grande es un error de medidas
      const maxRecorte = Math.max(tol, e) + 1
      const okq = r1q && r1q.cuanto <= maxRecorte ? r1q : null
      const okp = r1p && r1p.cuanto <= maxRecorte ? r1p : null
      const usarQ = okq && (!okp || okq.cuanto <= okp.cuanto)
      const [iq, ip, rr] = usarQ ? [q, p, okq!] : okp ? [p, q, okp] : [-1, -1, null]
      if (!rr) continue
      const X = fin[iq], Y = fin[ip]
      if (rr.s === 0) X.lo[rr.A] = Y.hi[rr.A]
      else X.hi[rr.A] = Y.lo[rr.A]
      const u: Union = { q: iq, A: rr.A as Eje, s: rr.s, p: ip, puntaje: 1, borde: 1 }
      uniones.push(u)
      unida.set(`${iq}:${rr.A}:${rr.s}`, u)
    }
  for (let a = 0; a < fin.length; a++)
    for (let b = a + 1; b < fin.length; b++)
      if (encima(fin[a], fin[b]) && !unidos(a, b)) errores.push(`${fin[a].nombre} y ${fin[b].nombre} se enciman: corrige sus medidas en la lista de tableros.`)

  for (const c of fin) {
    const corto = [0, 1, 2].filter((i) => i !== c.k).some((i) => c.hi[i] - c.lo[i] < 20)
    if (corto) errores.push(`${c.nombre} queda de menos de 2 cm con estas medidas.`)
  }

  // ---- 5. margen de las mortajas: P crece si la mortaja queda en su orilla ----
  const m = Math.max(12, e)
  for (let paso = 0; paso < 3 && tipoUnion === "espiga"; paso++) {
    let cambio = false
    for (const u of uniones) {
      const Q = fin[u.q], Pc = fin[u.p]
      const B = Q.k
      const fija0 = unida.has(`${u.p}:${B}:0`), fija1 = unida.has(`${u.p}:${B}:1`)
      if (Q.lo[B] - Pc.lo[B] < m - 0.05) {
        if (!fija0) {
          Pc.lo[B] = r1(Q.lo[B] - m)
          cambio = true
        }
      }
      if (Pc.hi[B] - Q.hi[B] < m - 0.05) {
        if (!fija1) {
          Pc.hi[B] = r1(Q.hi[B] + m)
          cambio = true
        }
      }
    }
    if (!cambio) break
  }

  // ---- 6. espigas y mortajas ----
  type Espiga = { a: number; b: number; L: number }
  const orillas = fin.map(() => new Map<string, Espiga[]>())
  const huecos: P[][][] = fin.map(() => [])
  const puestas: [number, number, number, number][][] = fin.map(() => []) // mortajas ya puestas en cada pieza (u0, u1, v0, v1)
  const huecosAb: [number, number, number, number][][] = fin.map(() => []) // aberturas ya puestas
  let alTope = 0
  // ---- 6b. herrajes: barrenos en la cara de P y en el canto (y la cara) de Q ----
  const barrenos: Barreno[][] = fin.map(() => [])
  const cantos: BarrenoCanto[][] = fin.map(() => [])
  const cuenta = { confirmat: 0, minifix: 0, taquete: 0 }
  const cxyz = [0, 1, 2].map((i) => (Math.min(...fin.map((c) => c.lo[i])) + Math.max(...fin.map((c) => c.hi[i]))) / 2)
  const enPlano = (k: Eje, val: Record<number, number>): [number, number] => [val[EJE_U[k]], val[EJE_V[k]]]
  const herraje = (u: Union) => {
    const Q = fin[u.q], Pc = fin[u.p]
    const A = u.A, B = Q.k
    const C = (3 - A - B) as Eje
    const c0 = Math.max(Q.lo[C], Pc.lo[C]), c1 = Math.min(Q.hi[C], Pc.hi[C])
    const d = c1 - c0
    const largoQ = Q.hi[A] - Q.lo[A]
    if (d < 60 || traslape(Q.lo[B], Q.hi[B], Pc.lo[B], Pc.hi[B]) < e - 0.05 || (tipoUnion === "minifix" && largoQ < 80)) {
      alTope++
      return
    }
    // posiciones a lo largo de la unión: a 50 mm de cada orilla y repartidas cada ~300 mm
    const borde = Math.min(50, d / 4)
    const tramo = d - 2 * borde
    const n = d < 120 ? 1 : 1 + Math.max(1, Math.ceil(tramo / (tipoUnion === "taquete" ? 200 : 320)))
    const pos = n === 1 ? [c0 + d / 2] : Array.from({ length: n }, (_, j) => c0 + borde + (tramo * j) / (n - 1))
    const centroB = (Q.lo[B] + Q.hi[B]) / 2
    const caraP: 0 | 1 = u.s === 0 ? 1 : 0 // Q está del lado de la cara mayor de P si su extremo menor llega a P
    const finQ = u.s === 0 ? Q.lo[A] : Q.hi[A]
    const haciaQ = u.s === 0 ? 1 : -1
    // ¿cabe un barreno en esta pieza? (contra los barrenos de las dos caras y los huecos pasados)
    const cabe = (i: number, cara: 0 | 1, bu: number, bv: number, dd: number, prof: number) => {
      for (const b of barrenos[i]) {
        const cerca = Math.hypot(b.u - bu, b.v - bv) < (b.d + dd) / 2 + 3
        if (cerca && (b.cara === cara || b.prof + prof > e - 2)) return false
      }
      for (const h of huecos[i]) {
        const us = h.map((q) => q[0]), vs = h.map((q) => q[1])
        if (bu + dd / 2 + 3 > Math.min(...us) && bu - dd / 2 - 3 < Math.max(...us) && bv + dd / 2 + 3 > Math.min(...vs) && bv - dd / 2 - 3 < Math.max(...vs)) return false
      }
      return true
    }
    type Plan = { i: number; cara: 0 | 1; u: number; v: number; d: number; prof: number; tipo: string; canto?: { cpos: number; d: number; prof: number } }
    const planP = (cpos: number, dd: number, prof: number, tipo: string, canto: { d: number; prof: number }): Plan => {
      const [pu, pv] = enPlano(Pc.k, { [B]: centroB, [C]: cpos })
      return { i: u.p, cara: caraP, u: pu, v: pv, d: dd, prof, tipo, canto: { cpos, ...canto } }
    }
    const poner = (pl: Plan[]) => {
      // revisa todo el grupo junto (cada barreno contra los ya puestos y contra los del grupo)
      const prueba: Plan[] = []
      for (const b of pl) {
        if (!cabe(b.i, b.cara, b.u, b.v, b.d, Math.min(b.prof, e))) return false
        // el barreno de canto no debe cruzarse con otro barreno de canto de Q
        if (b.canto) {
          const [qu, qv] = enPlano(Q.k, { [A]: finQ, [C]: b.canto.cpos })
          const dir = enPlano(Q.k, { [A]: haciaQ, [C]: 0 })
          const nuevo: [number, number, number, number] = [qu, qv, qu + dir[0] * b.canto.prof, qv + dir[1] * b.canto.prof]
          if (cantos[u.q].some((c) => distSegmentos(nuevo, [c.u, c.v, c.u + c.du * c.prof, c.v + c.dv * c.prof]) < (c.d + b.canto!.d) / 2 + 2)) return false
        }
        if (prueba.some((x) => x.i === b.i && Math.hypot(x.u - b.u, x.v - b.v) < (x.d + b.d) / 2 + 3)) return false
        prueba.push(b)
      }
      for (const b of pl) {
        if (b.prof >= e) huecos[b.i].push(circuloPts(b.u, b.v, b.d / 2))
        else barrenos[b.i].push({ u: b.u, v: b.v, d: b.d, prof: b.prof, cara: b.cara, tipo: b.tipo })
        if (b.canto) {
          const [qu, qv] = enPlano(Q.k, { [A]: finQ, [C]: b.canto.cpos })
          const dir = enPlano(Q.k, { [A]: haciaQ, [C]: 0 })
          cantos[u.q].push({ u: qu, v: qv, du: dir[0], dv: dir[1], d: b.canto.d, prof: b.canto.prof, tipo: b.tipo })
        }
      }
      return true
    }
    // la caja del minifix va en la cara de Q que mira al interior del mueble
    const caraQ: 0 | 1 = cxyz[B] >= (Q.lo[B] + Q.hi[B]) / 2 ? 1 : 0
    const distMinifix = e >= 16 ? 34 : 24
    const grupo = (cp: number): Plan[] => {
      if (tipoUnion === "confirmat") return [planP(cp, 7, e, "confirmat", { d: 5, prof: 45 })]
      if (tipoUnion === "taquete") return [planP(cp, 8, Math.min(12, e - 4), "taquete", { d: 8, prof: 25 })]
      const [qu, qv] = enPlano(Q.k, { [A]: finQ + haciaQ * distMinifix, [C]: cp })
      return [planP(cp, 8, Math.min(11, e - 4), "minifix-perno", { d: 8, prof: distMinifix }), { i: u.q, cara: caraQ, u: qu, v: qv, d: 15, prof: Math.min(13.5, e - 2), tipo: "minifix" }]
    }
    let puestos = 0
    for (const cp0 of pos) {
      // si choca con otro herraje se corre sobre la unión; si no cabe, se omite
      for (const corr of [0, 15, -15, 30, -30, 45, -45]) {
        const cp = cp0 + corr
        if (cp < c0 + 15 || cp > c1 - 15) continue
        if (!poner(grupo(cp))) continue
        puestos++
        if (tipoUnion === "confirmat") cuenta.confirmat++
        else if (tipoUnion === "taquete") cuenta.taquete++
        else {
          cuenta.minifix++
          // un taquete a 32 mm del minifix, hacia el centro de la unión
          const tq = cp + (cp < c0 + d / 2 ? 32 : -32)
          if (tq > c0 + 20 && tq < c1 - 20 && poner([planP(tq, 8, Math.min(12, e - 4), "taquete", { d: 8, prof: 25 })])) cuenta.taquete++
        }
        break
      }
    }
    if (!puestos) alTope++
  }
  for (const u of uniones) {
    if (tipoUnion !== "espiga") {
      herraje(u)
      continue
    }
    const Q = fin[u.q], Pc = fin[u.p]
    const A = u.A, B = Q.k
    const C = (3 - A - B) as Eje
    // las espigas no van pegadas a la orilla de P (la mortaja se rompería)
    const c0 = Math.max(Q.lo[C], Pc.lo[C] + m), c1 = Math.min(Q.hi[C], Pc.hi[C] - m)
    const d = c1 - c0
    if (traslape(Q.lo[B], Q.hi[B], Pc.lo[B], Pc.hi[B]) < e - 0.05 || d < 40) {
      alTope++
      continue
    }
    // ¿otra pieza llega a la misma zona de P por el lado contrario?
    const compartida = uniones.some((w) => {
      if (w === u || w.p !== u.p || w.A !== A || w.s === u.s) return false
      const W = fin[w.q]
      const hol = cl + r + 2 // mortajas vecinas: el juego y los alivios también cuentan
      return W.k === B && traslape(W.lo[B] - hol, W.hi[B] + hol, Q.lo[B], Q.hi[B]) > 0 && traslape(W.lo[C], W.hi[C], c0, c1) > 0
    })
    let tw = Math.max(25, Math.min(80, d * 0.22))
    const nPedidas = Math.max(0, Math.min(6, Math.round(o0.numEspigas || 0)))
    if (o0.anchoEspiga && o0.anchoEspiga > 0) tw = Math.max(8, Math.min(o0.anchoEspiga, d * 0.9))
    let fr: number[]
    if (compartida) {
      tw = Math.min(tw, d * 0.12)
      fr = d > 140 ? (u.s === 0 ? [0.125, 0.625] : [0.375, 0.875]) : u.s === 0 ? [0.3] : [0.7]
    } else if (nPedidas > 0) {
      // espigas pedidas: repartidas parejo a lo largo de la unión (si caben)
      const n = Math.max(1, Math.min(nPedidas, Math.floor(d / (tw + 2 * (r + 2) + 4))))
      tw = Math.min(tw, (d / n) * 0.7)
      fr = Array.from({ length: n }, (_, k) => (k + 0.5) / n)
    } else fr = d > 140 ? [0.25, 0.75] : [0.5]
    const L = compartida ? e : e + saliente
    // cada espiga busca un lugar libre en P: si choca con otra mortaja se corre
    // sobre su orilla; si no hay lugar, se omite
    const kp = Pc.k
    const sep = r + 2
    const lista: Espiga[] = []
    for (const f of fr) {
      const ideal = c0 + d * f - tw / 2
      const libre = (a: number) => {
        const rango: Record<number, [number, number]> = { [B]: [Q.lo[B] - cl, Q.hi[B] + cl], [C]: [a - cl, a + tw + cl] }
        const ru = rango[EJE_U[kp]], rv = rango[EJE_V[kp]]
        const ok = puestas[u.p].every((q) => ru[1] + sep <= q[0] || q[1] + sep <= ru[0] || rv[1] + sep <= q[2] || q[3] + sep <= rv[0]) && lista.every((t) => a + tw + sep <= t.a || t.b + sep <= a)
        return ok ? ([ru[0], ru[1], rv[0], rv[1]] as [number, number, number, number]) : null
      }
      let elegido: number | null = null
      for (let paso = 0; paso <= d; paso += 2) {
        for (const a of paso === 0 ? [ideal] : [ideal + paso, ideal - paso]) {
          if (a < c0 || a + tw > c1) continue
          if (libre(a)) {
            elegido = a
            break
          }
        }
        if (elegido !== null) break
      }
      if (elegido === null) continue
      const caja = libre(elegido)!
      puestas[u.p].push(caja)
      huecos[u.p].push(mortaja(caja[0], caja[2], caja[1], caja[3], r, o0.alivio || "hueso"))
      lista.push({ a: elegido, b: elegido + tw, L })
    }
    if (!lista.length) {
      alTope++
      continue
    }
    const clave = `${A}:${u.s}`
    orillas[u.q].set(clave, [...(orillas[u.q].get(clave) || []), ...lista].sort((x, y) => x.a - y.a))
  }
  if (alTope) avisos.push(`${alTope} unión${alTope > 1 ? "es son" : " es"} muy angosta${alTope > 1 ? "s" : ""} para ${tipoUnion === "espiga" ? "espiga" : "herraje"} y queda${alTope > 1 ? "n" : ""} a tope: lleva${alTope > 1 ? "n" : ""} pegamento.`)
  const compras: Mueble["compras"] = []
  if (cuenta.confirmat) compras.push({ nombre: "Tornillo confirmat 7 × 50", cantidad: Math.ceil(cuenta.confirmat * 1.05), nota: "Broca escalonada para confirmat; avellana la cara de afuera." })
  if (cuenta.minifix) compras.push({ nombre: "Minifix 15 mm (caja y perno)", cantidad: cuenta.minifix, nota: `Caja a ${e >= 16 ? 34 : 24} mm de la orilla.` })
  if (cuenta.taquete) compras.push({ nombre: "Taquete de madera 8 × 30", cantidad: Math.ceil(cuenta.taquete * 1.1), nota: "Con pegamento blanco." })
  if (tipoUnion !== "espiga" && (cuenta.confirmat || cuenta.minifix || cuenta.taquete))
    avisos.push("Los barrenos de cara van en el archivo (capas BARRENO). Los de canto se hacen con taladro y guía: van marcados en la orilla de cada pieza (capas CANTO).")

  // aberturas: dentro del cuerpo de la pieza y lejos de las mortajas
  let abFuera = 0
  fin.forEach((c, i) => {
    const U = EJE_U[c.k], V = EJE_V[c.k]
    for (const [a0, b0, a1, b1] of c.ab) {
      const dentro = a0 >= c.lo[U] + 10 && a1 <= c.hi[U] - 10 && b0 >= c.lo[V] + 10 && b1 <= c.hi[V] - 10 && a1 - a0 >= 10 && b1 - b0 >= 10
      const libre = puestas[i].every((q) => a1 + 5 <= q[0] || q[1] + 5 <= a0 || b1 + 5 <= q[2] || q[3] + 5 <= b0)
      const entreAberturas = huecosAb[i].every((q) => a1 + 5 <= q[0] || q[1] + 5 <= a0 || b1 + 5 <= q[2] || q[3] + 5 <= b0)
      if (!dentro || !libre || !entreAberturas) {
        abFuera++
        continue
      }
      huecosAb[i].push([a0, a1, b0, b1])
      huecos[i].push([[a0, b0], [a1, b0], [a1, b1], [a0, b1]])
    }
  })
  if (abFuera) avisos.push(`${abFuera} hueco${abFuera > 1 ? "s quedaron" : " quedó"} fuera del tablero o encima de una mortaja y no se ${abFuera > 1 ? "cortan" : "corta"}: muévelo${abFuera > 1 ? "s" : ""}.`)

  const piezas: PiezaTablero[] = fin.map((c, i) => {
    const U = EJE_U[c.k], V = EJE_V[c.k]
    const u0 = c.lo[U], u1 = c.hi[U], v0 = c.lo[V], v1 = c.hi[V]
    const es = (A: Eje, s: 0 | 1) => orillas[i].get(`${A}:${s}`) || []
    const pts: P[] = [[u0, v0]]
    for (const t of es(V, 0)) pts.push([t.a, v0], [t.a, v0 - t.L], [t.b, v0 - t.L], [t.b, v0])
    pts.push([u1, v0])
    for (const t of es(U, 1)) pts.push([u1, t.a], [u1 + t.L, t.a], [u1 + t.L, t.b], [u1, t.b])
    pts.push([u1, v1])
    for (const t of [...es(V, 1)].reverse()) pts.push([t.b, v1], [t.b, v1 + t.L], [t.a, v1 + t.L], [t.a, v1])
    pts.push([u0, v1])
    for (const t of [...es(U, 0)].reverse()) pts.push([u0, t.b], [u0 - t.L, t.b], [u0 - t.L, t.a], [u0, t.a])
    // esquinas exteriores (sólo las 4 del rectángulo de la pieza, si no hay espiga en ellas)
    const esq = o0.esquinas && o0.esquinas.tipo !== "recta" ? esquinasExteriores(pts, o0.esquinas.tipo, Math.max(0, Math.min(100, o0.esquinas.medida || 0)), (q) => (Math.abs(q[0] - u0) < 1e-6 || Math.abs(q[0] - u1) < 1e-6) && (Math.abs(q[1] - v0) < 1e-6 || Math.abs(q[1] - v1) < 1e-6)) : pts
    return { nombre: c.nombre, plano: PLANO[c.k], contorno: exteriorConAlivios(esq, r, o0.alivio || "hueso"), huecos: huecos[i], desfase: c.lo[c.k], grosor: e, origen: c.origen, indice: i, barrenos: barrenos[i], cantos: cantos[i] }
  })

  // ---- 7. revisiones ----
  if (r > 0 && 2 * r > e + holgura - 0.2) errores.push(`La fresa de ${2 * r} mm no cabe en mortajas de ${(e + holgura).toFixed(1)} mm: usa una fresa más delgada o un tablero más grueso.`)
  for (const pz of piezas) {
    const us = pz.contorno.map((q) => q[0]), vs = pz.contorno.map((q) => q[1])
    const a = Math.max(...us) - Math.min(...us), b = Math.max(...vs) - Math.min(...vs)
    if (Math.min(a, b) > 1220 || Math.max(a, b) > 2440) {
      errores.push(`${pz.nombre} mide ${Math.round(Math.max(a, b))} × ${Math.round(Math.min(a, b))} mm y no cabe en un tablero de 2440 × 1220 mm.`)
      break
    }
  }
  const nUniones = (i: number) => uniones.filter((u) => u.q === i || u.p === i).length
  const firmes = (k: Eje) => fin.some((c, i) => c.k === k && nUniones(i) >= 2)
  if (!firmes(1)) avisos.push("No hay respaldo, frente ni travesaño unido a dos piezas: el mueble puede ladearse de lado. Agrega uno.")
  if (!firmes(0)) avisos.push("No hay costado ni pata de tablero unido a dos piezas: el mueble puede ladearse de frente.")
  if (descartados.length) avisos.push(`Se quitaron ${descartados.length} tablero${descartados.length > 1 ? "s" : ""}: ${descartados.join(", ")}.`)
  if (o0.herramienta.tipo === "fresa" && o0.herramienta.diametro > e * 0.7) avisos.push("La fresa es gruesa para ese tablero: los alivios de las esquinas se notarán.")

  // medidas del mueble terminado: con las espigas que sobresalen
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (const pz of piezas)
    for (const [u, v] of pz.contorno)
      for (const w of [0, pz.grosor]) {
        const q = aMueble(pz, u, v, w)
        for (const i of [0, 1, 2]) {
          lo[i] = Math.min(lo[i], q[i])
          hi[i] = Math.max(hi[i], q[i])
        }
      }
  return {
    piezas,
    compras,
    medidas: { ancho: Math.round(hi[0] - lo[0]), fondo: Math.round(hi[1] - lo[1]), alto: Math.round(hi[2] - lo[2]) },
    errores,
    avisos,
    descartados,
    uniones: uniones.length,
    aTope: alTope,
    original,
    tablerosFinales: fin.map((c) => aTablero(c)),
    sueltos: fuera.map((c) => {
      // se llevan a la misma escala que el mueble, con el grosor nuevo
      const lo = [0, 1, 2].map((i) => mapa(i, c.lo[i])), hi = [0, 1, 2].map((i) => mapa(i, c.hi[i]))
      const m = (lo[c.k] + hi[c.k]) / 2
      lo[c.k] = m - e / 2
      hi[c.k] = m + e / 2
      const U = EJE_U[c.k], V = EJE_V[c.k]
      return aTablero({ ...c, lo, hi, ab: c.ab.map((h) => [mapa(U, h[0]), mapa(V, h[1]), mapa(U, h[2]), mapa(V, h[3])]) })
    }),
  }
}
