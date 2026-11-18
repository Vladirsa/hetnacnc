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

import { type Herramienta, type Mueble, type P, type PiezaEnsamble, type Plano, exteriorConAlivios, mortaja } from "./ensamble"

export type Tablero = { nombre: string; plano?: Plano; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export type OpcionesTableros = {
  ancho?: number // medidas totales deseadas (sin dato = las de la lectura)
  fondo?: number
  alto?: number
  grosor: number
  holgura: number
  saliente: number // cuánto sobresalen las espigas pasadas (0 = al ras)
  herramienta: Herramienta
}

export const TABLEROS_INICIO: Omit<OpcionesTableros, "ancho" | "fondo" | "alto"> = {
  grosor: 18,
  holgura: 0.3,
  saliente: 0,
  herramienta: { tipo: "fresa", diametro: 6.35 },
}

export type MuebleTableros = Mueble & { descartados: string[]; uniones: number; original: { ancho: number; fondo: number; alto: number } }

type Eje = 0 | 1 | 2
type Caja = { nombre: string; k: Eje; lo: number[]; hi: number[] }
// puntaje: qué tanto cae el grueso de Q dentro de P; borde: qué tanto de la orilla de Q cae en P
type Union = { q: number; A: Eje; s: 0 | 1; p: number; puntaje: number; borde: number }

const PLANO: Record<Eje, Plano> = { 0: "lateral", 1: "frontal", 2: "horizontal" }
// ejes (u, v) del plano de cada pieza, igual que aMueble()
const EJE_U: Record<Eje, Eje> = { 0: 1, 1: 0, 2: 0 }
const EJE_V: Record<Eje, Eje> = { 0: 2, 1: 2, 2: 1 }
const MAX_TABLEROS = 60
const traslape = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
const r1 = (v: number) => Math.round(v * 10) / 10

export function cajaDeTablero(t: Tablero) {
  return { lo: [Math.min(t.x0, t.x1), Math.min(t.y0, t.y1), Math.min(t.z0, t.z1)], hi: [Math.max(t.x0, t.x1), Math.max(t.y0, t.y1), Math.max(t.z0, t.z1)] }
}

export function muebleDeTableros(tableros: Tablero[], o0: OpcionesTableros): MuebleTableros {
  const errores: string[] = []
  const avisos: string[] = []
  const descartados: string[] = []
  const acotar = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a)
  const e = acotar(o0.grosor, 6, 30)
  const holgura = acotar(o0.holgura, 0, 2)
  const saliente = acotar(o0.saliente, 0, 60)
  const cl = holgura / 2
  const r = o0.herramienta.tipo === "fresa" ? Math.max(0.5, o0.herramienta.diametro / 2) : 0
  const vacio = (msg: string): MuebleTableros => ({ piezas: [], compras: [], medidas: { ancho: 0, fondo: 0, alto: 0 }, errores: [msg], avisos, descartados, uniones: 0, original: { ancho: 0, fondo: 0, alto: 0 } })

  // ---- 1. limpiar la lectura ----
  const nombres = new Map<string, number>()
  let cajas: Caja[] = []
  for (const t of tableros.slice(0, MAX_TABLEROS)) {
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
    cajas.push({ nombre, k, lo, hi })
  }
  if (tableros.length > MAX_TABLEROS) avisos.push(`Sólo se usaron los primeros ${MAX_TABLEROS} tableros.`)
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
  const principal = [...grupos.values()].sort((a, b) => b.length - a.length)[0]
  if (principal.length < 2) return { ...vacio("Los tableros no se tocan entre sí: no se puede armar el mueble. Revisa sus medidas."), original }
  if (principal.length < cajas.length) {
    const queda = new Set(principal)
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
    return { nombre: c.nombre, k, lo, hi }
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
      const usarQ = r1q && (!r1p || r1q.cuanto <= r1p.cuanto)
      const [iq, ip, rr] = usarQ ? [q, p, r1q!] : r1p ? [p, q, r1p] : [-1, -1, null]
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
  for (let paso = 0; paso < 3; paso++) {
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
  let alTope = 0
  for (const u of uniones) {
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
    let fr: number[]
    if (compartida) {
      tw = Math.min(tw, d * 0.12)
      fr = d > 140 ? (u.s === 0 ? [0.125, 0.625] : [0.375, 0.875]) : u.s === 0 ? [0.3] : [0.7]
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
      huecos[u.p].push(mortaja(caja[0], caja[2], caja[1], caja[3], r))
      lista.push({ a: elegido, b: elegido + tw, L })
    }
    if (!lista.length) {
      alTope++
      continue
    }
    const clave = `${A}:${u.s}`
    orillas[u.q].set(clave, [...(orillas[u.q].get(clave) || []), ...lista].sort((x, y) => x.a - y.a))
  }
  if (alTope) avisos.push(`${alTope} unión${alTope > 1 ? "es son" : " es"} muy angosta${alTope > 1 ? "s" : ""} para espiga y queda${alTope > 1 ? "n" : ""} a tope: lleva${alTope > 1 ? "n" : ""} pegamento.`)

  const piezas: PiezaEnsamble[] = fin.map((c, i) => {
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
    return { nombre: c.nombre, plano: PLANO[c.k], contorno: exteriorConAlivios(pts, r), huecos: huecos[i], desfase: c.lo[c.k], grosor: e }
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

  const lo = [0, 1, 2].map((i) => Math.min(...fin.map((c) => c.lo[i])))
  const hi = [0, 1, 2].map((i) => Math.max(...fin.map((c) => c.hi[i])))
  return {
    piezas,
    compras: [],
    medidas: { ancho: Math.round(hi[0] - lo[0]), fondo: Math.round(hi[1] - lo[1]), alto: Math.round(hi[2] - lo[2]) },
    errores,
    avisos,
    descartados,
    uniones: uniones.length,
    original,
  }
}
