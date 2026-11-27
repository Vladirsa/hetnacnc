// Ayudantes para contornos (P[][]: polígonos cerrados en mm) que comparten los
// motores de placas, letreros, pruebas, reloj y organizador.
import { extruir } from "@/lib/generador/extruir"
import type { P } from "@/lib/generador/vectores"

/** Limpieza de clipper (desplazar de cortadores.ts) cuando las figuras ya están en mm: 0.01 mm. */
export const LIMPIEZA_MM = 10

export function cajaDe(c: P[][]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of c) for (const [x, y] of p) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y))
  return { x0, y0, x1, y1 }
}

/** Mueve (y escala desde el origen) los contornos. */
export const moverC = (c: P[][], dx: number, dy: number, k = 1): P[][] => c.map((p) => p.map(([x, y]) => [x * k + dx, y * k + dy] as P))

export const rectPts = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

export function rectRedondo(x0: number, y0: number, x1: number, y1: number, r: number): P[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01))
  if (r < 0.2) return rectPts(x0, y0, x1, y1)
  const pts: P[] = []
  const esquina = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2)
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  esquina(x1 - r, y0 + r, -Math.PI / 2)
  esquina(x1 - r, y1 - r, 0)
  esquina(x0 + r, y1 - r, Math.PI / 2)
  esquina(x0 + r, y0 + r, Math.PI)
  return pts
}

export const circuloPts = (cx: number, cy: number, r: number, m = 32): P[] =>
  Array.from({ length: m }, (_, i) => [cx + r * Math.cos((i / m) * 2 * Math.PI), cy + r * Math.sin((i / m) * 2 * Math.PI)] as P)

/** Área con signo (positiva en sentido contrario a las manecillas). */
export const areaPts = (p: P[]) => p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0) / 2

/** Contornos (con huecos) extruidos de z0 a z0 + alto: malla cerrada de triángulos. */
export function extruirEn(pts: P[][], alto: number, z0 = 0): number[] {
  if (!pts.length || !(alto > 0)) return []
  const t = extruir({ trazos: pts.map((q) => ({ pts: q, cerrado: true, capa: "X" })), avisos: [], unidades: "mm" }, { alto, base: 0, margenBase: 0, redondearBase: 0, espejo: false }).malla.tris
  if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0
  return t
}
