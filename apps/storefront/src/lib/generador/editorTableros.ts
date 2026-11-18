// Operaciones del editor de muebles (tipo SketchUp) sobre la lista de tableros.
// Todas regresan una lista nueva; el motor (tableros.ts) vuelve a calcular las
// uniones. Se trabaja sobre los tableros ya armados (MuebleTableros.tablerosFinales),
// así lo que se edita es exactamente lo que se ve.

import type { Abertura, Tablero } from "./tableros"

export type Eje = 0 | 1 | 2
export type TipoNuevo = "repisa" | "division" | "respaldo" | "travesano"
type Pt = [number, number, number]

const LO = ["x0", "y0", "z0"] as const
const HI = ["x1", "y1", "z1"] as const
export const lo = (t: Tablero, i: Eje) => t[LO[i]]
export const hi = (t: Tablero, i: Eje) => t[HI[i]]
// eje delgado (el grosor) de un tablero
export const ejeDelgado = (t: Tablero): Eje => {
  const ext = [t.x1 - t.x0, t.y1 - t.y0, t.z1 - t.z0]
  return ext.indexOf(Math.min(...ext)) as Eje
}
const PLANO_DE: Record<Eje, Tablero["plano"]> = { 0: "lateral", 1: "frontal", 2: "horizontal" }

// Empujar/jalar una cara (lado 0 = cara menor, 1 = cara mayor) sobre un eje.
// Si es la cara grande del tablero (su grosor), se mueve el tablero completo.
export function empujar(ts: Tablero[], i: number, eje: Eje, lado: 0 | 1, delta: number): Tablero[] {
  const t = ts[i]
  if (!t || !delta) return ts
  const n = { ...t }
  if (eje === ejeDelgado(t)) {
    n[LO[eje]] += delta
    n[HI[eje]] += delta
  } else if (lado === 1) n[HI[eje]] = Math.max(n[LO[eje]] + 20, n[HI[eje]] + delta)
  else n[LO[eje]] = Math.min(n[HI[eje]] - 20, n[LO[eje]] + delta)
  // al estirar desde la cara menor, las aberturas se quedan en su lugar del mueble
  if (eje !== ejeDelgado(t) && lado === 0 && n.aberturas) {
    const real = n[LO[eje]] - t[LO[eje]]
    const enU = ejeU(t) === eje
    n.aberturas = n.aberturas.map((a) => (enU ? { ...a, u0: a.u0 - real, u1: a.u1 - real } : { ...a, v0: a.v0 - real, v1: a.v1 - real }))
  }
  return ts.map((x, j) => (j === i ? n : x))
}

export function mover(ts: Tablero[], i: number, d: Pt): Tablero[] {
  return ts.map((t, j) => (j === i ? { ...t, x0: t.x0 + d[0], x1: t.x1 + d[0], y0: t.y0 + d[1], y1: t.y1 + d[1], z0: t.z0 + d[2], z1: t.z1 + d[2] } : t))
}

export function quitar(ts: Tablero[], i: number): Tablero[] {
  return ts.filter((_, j) => j !== i)
}

// copia del tablero corrida sobre su grosor (una repisa más arriba, una división al lado)
export function duplicar(ts: Tablero[], i: number): Tablero[] {
  const t = ts[i]
  if (!t) return ts
  const k = ejeDelgado(t)
  const caja = cajaTotal(ts)
  const paso = Math.max(120, Math.min(300, (hi2(caja, k) - lo2(caja, k)) / 5))
  const sube = hi(t, k) + paso <= hi2(caja, k) - 10 ? paso : -paso
  const n = { ...t, nombre: nombreLibre(ts, t.nombre) }
  n[LO[k]] += sube
  n[HI[k]] += sube
  return [...ts, n]
}

// Agrega un tablero que llena el hueco alrededor del punto (lo que el cliente
// tocó en la vista 3D, o el centro del mueble): busca los tableros que lo
// encierran a cada lado y se ajusta entre sus caras.
export function agregar(ts: Tablero[], tipo: TipoNuevo, punto: Pt | null, e: number): { tableros: Tablero[]; indice: number } {
  const caja = cajaTotal(ts)
  const p: Pt = punto || [(caja[0] + caja[3]) / 2, (caja[1] + caja[4]) / 2, (caja[2] + caja[5]) / 2]
  // tablero más cercano con grosor en el eje k que encierra al punto en los otros ejes, hacia - o +
  const tope = (k: Eje, hacia: -1 | 1): number => {
    let mejor = hacia < 0 ? lo2(caja, k) : hi2(caja, k)
    for (const t of ts) {
      if (ejeDelgado(t) !== k) continue
      const otros = ([0, 1, 2] as Eje[]).filter((i) => i !== k)
      if (!otros.every((i) => lo(t, i) - 1 <= p[i] && p[i] <= hi(t, i) + 1)) continue
      if (hacia < 0 && hi(t, k) <= p[k] + 0.5) mejor = Math.max(mejor, hi(t, k))
      if (hacia > 0 && lo(t, k) >= p[k] - 0.5) mejor = Math.min(mejor, lo(t, k))
    }
    return mejor
  }
  const x0 = tope(0, -1), x1 = tope(0, 1)
  const y0 = tope(1, -1), y1 = tope(1, 1)
  const z0 = tope(2, -1), z1 = tope(2, 1)
  let t: Tablero
  if (tipo === "repisa") {
    const z = Math.max(z0, Math.min(z1 - e, p[2] - e / 2))
    t = { nombre: "Repisa", plano: "horizontal", x0, x1, y0, y1, z0: z, z1: z + e }
  } else if (tipo === "division") {
    const x = Math.max(x0, Math.min(x1 - e, p[0] - e / 2))
    t = { nombre: "División", plano: "lateral", x0: x, x1: x + e, y0, y1, z0, z1 }
  } else if (tipo === "respaldo") {
    t = { nombre: "Respaldo", plano: "frontal", x0, x1, y0: y1 - e, y1, z0, z1 }
  } else {
    const alto = Math.min(120, Math.max(60, (z1 - z0) * 0.25))
    t = { nombre: "Travesaño", plano: "frontal", x0, x1, y0: y1 - e, y1, z0: z1 - alto, z1 }
  }
  t.nombre = nombreLibre(ts, t.nombre)
  t.plano = PLANO_DE[ejeDelgado(t)]
  return { tableros: [...ts, t], indice: ts.length }
}

// Hueco rectangular (pasacables, ventana, agarradera) centrado en el tablero o en el punto tocado
export function abrirHueco(ts: Tablero[], i: number, ancho: number, alto: number, punto: Pt | null): Tablero[] {
  const t = ts[i]
  if (!t) return ts
  const U = ejeU(t), V = ejeV(t)
  const lu = hi(t, U) - lo(t, U), lv = hi(t, V) - lo(t, V)
  const w = Math.min(ancho, lu - 40), h = Math.min(alto, lv - 40)
  if (w < 10 || h < 10) return ts
  let cu = punto ? punto[U] - lo(t, U) : lu / 2
  let cv = punto ? punto[V] - lo(t, V) : lv / 2
  cu = Math.max(20 + w / 2, Math.min(lu - 20 - w / 2, cu))
  cv = Math.max(20 + h / 2, Math.min(lv - 20 - h / 2, cv))
  const a: Abertura = { u0: Math.round(cu - w / 2), v0: Math.round(cv - h / 2), u1: Math.round(cu + w / 2), v1: Math.round(cv + h / 2) }
  return ts.map((x, j) => (j === i ? { ...x, aberturas: [...(x.aberturas || []), a] } : x))
}

export function quitarHuecos(ts: Tablero[], i: number): Tablero[] {
  return ts.map((x, j) => (j === i ? { ...x, aberturas: [] } : x))
}

// ---- utilidades ----
export const ejeU = (t: Tablero): Eje => (ejeDelgado(t) === 0 ? 1 : 0)
export const ejeV = (t: Tablero): Eje => (ejeDelgado(t) === 2 ? 1 : 2)
function cajaTotal(ts: Tablero[]): number[] {
  if (!ts.length) return [0, 0, 0, 600, 300, 600]
  return [Math.min(...ts.map((t) => t.x0)), Math.min(...ts.map((t) => t.y0)), Math.min(...ts.map((t) => t.z0)), Math.max(...ts.map((t) => t.x1)), Math.max(...ts.map((t) => t.y1)), Math.max(...ts.map((t) => t.z1))]
}
const lo2 = (c: number[], k: Eje) => c[k]
const hi2 = (c: number[], k: Eje) => c[k + 3]
function nombreLibre(ts: Tablero[], base: string): string {
  const raiz = base.replace(/\s+\d+$/, "")
  const usados = new Set(ts.map((t) => t.nombre))
  if (!usados.has(raiz)) return raiz
  for (let n = 2; ; n++) if (!usados.has(`${raiz} ${n}`)) return `${raiz} ${n}`
}
