// COPIA de apps/storefront/src/lib/simulador/material.ts (el servidor califica con el mismo motor).
// No editar aquí: edita el original y copia. Una prueba revisa que sean iguales.
// Simulador CNC: el bloque de material como un mapa de alturas (una cuadrícula
// vista desde arriba). Cada vez que la fresa pasa, baja la altura de las celdas
// que toca a la profundidad de su punta. Sirve para fresas planas, de bola y en V
// (no simula cortes por debajo de una ceja, que en 3 ejes no existen).
import { cajaMaterial, type Material, type Punto } from "./gcode"

export type Fresa = { diametro: number; tipo: "plana" | "bola" | "v"; angulo?: number }

export class Bloque {
  readonly nx: number
  readonly ny: number
  readonly celda: number
  readonly x0: number
  readonly y0: number
  readonly alto: number
  readonly h: Float32Array // altura de la cara de arriba en cada celda (0 = sin cortar)

  constructor(m: Material, maxCeldas = 260) {
    const c = cajaMaterial(m)
    this.celda = Math.max(m.ancho, m.largo) / maxCeldas
    this.nx = Math.max(2, Math.round(m.ancho / this.celda) + 1)
    this.ny = Math.max(2, Math.round(m.largo / this.celda) + 1)
    this.x0 = c.x0
    this.y0 = c.y0
    this.alto = m.alto
    this.h = new Float32Array(this.nx * this.ny)
  }

  reiniciar() {
    this.h.fill(0)
  }

  /** Altura de la punta de la fresa a una distancia d del eje. */
  private perfil(f: Fresa, d: number): number {
    const r = f.diametro / 2
    if (f.tipo === "bola") return r - Math.sqrt(Math.max(0, r * r - d * d))
    if (f.tipo === "v") return d / Math.tan(((f.angulo || 60) * Math.PI) / 360)
    return 0
  }

  /**
   * Corta a lo largo del segmento a → b. Regresa el rango de celdas que cambió
   * (para redibujar sólo eso) o null si no tocó material.
   */
  cortar(a: Punto, b: Punto, f: Fresa): { i0: number; i1: number; j0: number; j1: number } | null {
    const r = f.diametro / 2
    if (Math.min(a.z, b.z) >= 0) return null // va por arriba del material
    const largo = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    const pasos = Math.max(1, Math.ceil(largo / (this.celda * 0.5)))
    const rc = Math.ceil(r / this.celda)
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity
    for (let s = 0; s <= pasos; s++) {
      const t = s / pasos
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      const z = a.z + (b.z - a.z) * t
      if (z >= 0) continue
      const ci = Math.round((x - this.x0) / this.celda)
      const cj = Math.round((y - this.y0) / this.celda)
      for (let j = Math.max(0, cj - rc); j <= Math.min(this.ny - 1, cj + rc); j++) {
        for (let i = Math.max(0, ci - rc); i <= Math.min(this.nx - 1, ci + rc); i++) {
          const dx = this.x0 + i * this.celda - x
          const dy = this.y0 + j * this.celda - y
          const d = Math.hypot(dx, dy)
          if (d > r) continue
          const zf = Math.max(z + this.perfil(f, d), -this.alto)
          const k = j * this.nx + i
          if (zf < this.h[k]) {
            this.h[k] = zf
            if (i < i0) i0 = i
            if (i > i1) i1 = i
            if (j < j0) j0 = j
            if (j > j1) j1 = j
          }
        }
      }
    }
    return i0 === Infinity ? null : { i0, i1, j0, j1 }
  }

  /** Volumen quitado en cm³ (para el resumen). */
  volumenQuitado(): number {
    let s = 0
    for (let k = 0; k < this.h.length; k++) s -= this.h[k]
    return (s * this.celda * this.celda) / 1000
  }
}
