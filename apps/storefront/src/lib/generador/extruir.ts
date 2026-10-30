// SVG o DXF → STL: extruye los contornos cerrados de un dibujo 2D a un sólido
// (letras, logotipos, siluetas) para imprimir en 3D o tallar en relieve.
// Todo en el navegador, en milímetros.
//
// Los contornos anidados se interpretan como agujeros (la "o" de un texto, el
// hueco de un llavero): un contorno con número par de contornos alrededor es
// pieza; con número impar, agujero de la pieza que lo rodea.

import { ShapeUtils, Vector2 } from "three"

import type { Dibujo, Malla, P } from "@/lib/generador/vectores"

export type OpcionesExtruir = {
  alto: number // altura de la extrusión (mm)
  base: number // grosor de la placa base (0 = sin placa)
  margenBase: number // cuánto sobresale la placa del dibujo por cada lado
  redondearBase: number // radio de las esquinas de la placa
  espejo: boolean // voltear (para que al imprimir boca abajo quede legible)
}

export type ResultadoExtruir = { malla: Malla; piezas: number; agujeros: number; errores: string[] }

const area2 = (pts: P[]) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

function dentro(p: P, poly: P[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// quita puntos repetidos y cierra bien el contorno
const limpiar = (pts: P[]) => {
  const out: P[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p)
  }
  if (out.length > 1) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) out.pop()
  }
  return out
}

export function extruir(d: Dibujo, o: OpcionesExtruir): ResultadoExtruir {
  const cerrados = d.trazos.filter((t) => t.cerrado).map((t) => limpiar(t.pts)).filter((p) => p.length >= 3 && Math.abs(area2(p)) > 0.01)
  if (!cerrados.length) return { malla: { tris: [], avisos: [] }, piezas: 0, agujeros: 0, errores: ["El dibujo no tiene contornos cerrados que extruir. Revisa que las líneas cierren o usa «Unir líneas sueltas» en el convertidor."] }

  // profundidad de anidado de cada contorno
  const prof = cerrados.map((c, i) => cerrados.filter((otro, j) => j !== i && dentro(c[0], otro)).length)
  const exteriores = cerrados.map((_, i) => i).filter((i) => prof[i] % 2 === 0)
  const agujerosDe: Record<number, number[]> = {}
  let agujeros = 0
  cerrados.forEach((c, i) => {
    if (prof[i] % 2 === 0) return
    // su pieza: el exterior más interno que lo contiene
    let mejor = -1
    for (const e of exteriores) if (prof[e] === prof[i] - 1 && dentro(c[0], cerrados[e])) mejor = e
    if (mejor >= 0) {
      ;(agujerosDe[mejor] ||= []).push(i)
      agujeros++
    }
  })

  const tris: number[] = []
  const h = o.alto
  const z0 = 0
  const sx = o.espejo ? -1 : 1
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => tris.push(a[0] * sx, a[1], a[2], b[0] * sx, b[1], b[2], c[0] * sx, c[1], c[2])

  // paredes de un contorno (antihorario = exterior, horario = agujero)
  const paredes = (pts: P[], z0: number, z1: number) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      tri([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1])
      tri([a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1])
    }
  }

  for (const e of exteriores) {
    const ext = area2(cerrados[e]) > 0 ? cerrados[e] : [...cerrados[e]].reverse()
    const hoyos = (agujerosDe[e] || []).map((i) => (area2(cerrados[i]) < 0 ? cerrados[i] : [...cerrados[i]].reverse()))
    const contorno = ext.map(([x, y]) => new Vector2(x, y))
    const huecos = hoyos.map((hh) => hh.map(([x, y]) => new Vector2(x, y)))
    let caras: number[][]
    try {
      caras = ShapeUtils.triangulateShape(contorno, huecos)
    } catch {
      continue
    }
    const todos = [...ext, ...hoyos.flat()]
    for (const [i, j, k] of caras) {
      const a = todos[i]
      // la tapa mira hacia arriba (triángulo antihorario visto desde +Z)
      const [b, c] = area2([todos[i], todos[j], todos[k]]) >= 0 ? [todos[j], todos[k]] : [todos[k], todos[j]]
      tri([a[0], a[1], z0 + h], [b[0], b[1], z0 + h], [c[0], c[1], z0 + h]) // tapa
      tri([a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0]) // fondo
    }
    paredes(ext, z0, z0 + h)
    for (const hh of hoyos) paredes(hh, z0, z0 + h)
  }

  // placa base (caja con esquinas redondeadas) debajo del dibujo
  if (o.base > 0) {
    const xs = cerrados.flat().map((p) => p[0])
    const ys = cerrados.flat().map((p) => p[1])
    const m = o.margenBase
    const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m
    const y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m
    const r = Math.max(0, Math.min(o.redondearBase, (x1 - x0) / 2, (y1 - y0) / 2))
    const placa: P[] = []
    if (r > 0) {
      const esq: [number, number, number][] = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]
      for (const [cx, cy, a0] of esq) for (let j = 0; j <= 8; j++) placa.push([cx + r * Math.cos(a0 + (Math.PI / 2) * (j / 8)), cy + r * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
    } else placa.push([x0, y0], [x1, y0], [x1, y1], [x0, y1])
    const caras = ShapeUtils.triangulateShape(placa.map(([x, y]) => new Vector2(x, y)), [])
    for (const [i, j, k] of caras) {
      const a = placa[i]
      const [b, c] = area2([placa[i], placa[j], placa[k]]) >= 0 ? [placa[j], placa[k]] : [placa[k], placa[j]]
      tri([a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z0])
      tri([a[0], a[1], -o.base], [c[0], c[1], -o.base], [b[0], b[1], -o.base])
    }
    paredes(placa, -o.base, z0)
  }

  // con espejo las caras quedan al revés: se invierte el orden de cada triángulo
  if (o.espejo) {
    for (let i = 0; i < tris.length; i += 9) {
      const b = tris.slice(i + 3, i + 6)
      tris.splice(i + 3, 3, ...tris.slice(i + 6, i + 9))
      tris.splice(i + 6, 3, ...b)
    }
  }

  const avisos: string[] = []
  const abiertos = d.trazos.filter((t) => !t.cerrado).length
  if (abiertos) avisos.push(`${abiertos} línea${abiertos === 1 ? "" : "s"} abierta${abiertos === 1 ? "" : "s"} se ignoraron: solo se extruyen contornos cerrados.`)
  return { malla: { tris, avisos }, piezas: exteriores.length, agujeros, errores: [] }
}
