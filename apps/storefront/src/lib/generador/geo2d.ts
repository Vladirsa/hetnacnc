// Geometría 2D sencilla para los generadores nuevos del 2D Studio (celosías,
// bisagra viva, QR, rebanado y los demás). Todo en milímetros, Y hacia
// arriba, y termina en un Dibujo (lib/generador/vectores.ts) que ya sabe
// escribirse en DXF y SVG.
import type { Curva } from "@/lib/generador/trazado"
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

export type { P, Trazo, Dibujo }

const TOL = 0.05 // mm de error al pasar curvas a tramos rectos

export const trazo = (pts: P[], cerrado = true, capa = "corte"): Trazo => ({ pts, cerrado, capa })

export function rect(x0: number, y0: number, x1: number, y1: number, r = 0, capa = "corte"): Trazo {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2))
  if (r < 0.01) return trazo([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, capa)
  const pts: P[] = []
  const esquina = (cx: number, cy: number, a0: number) => {
    const n = segmentos(r, Math.PI / 2)
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((Math.PI / 2) * i) / n
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  esquina(x1 - r, y0 + r, -Math.PI / 2)
  esquina(x1 - r, y1 - r, 0)
  esquina(x0 + r, y1 - r, Math.PI / 2)
  esquina(x0 + r, y0 + r, Math.PI)
  return trazo(pts, true, capa)
}

export function segmentos(r: number, barrido = Math.PI * 2) {
  if (!(r > 0)) return 3
  const d = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - TOL / r)))
  return Math.max(6, Math.min(360, Math.ceil(Math.abs(barrido) / (d || 0.1))))
}

export function circulo(cx: number, cy: number, r: number, capa = "corte"): Trazo {
  const n = segmentos(r)
  const pts: P[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return trazo(pts, true, capa)
}

export function arco(cx: number, cy: number, r: number, a0: number, a1: number): P[] {
  const n = segmentos(r, a1 - a0)
  const pts: P[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

export const mover = (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy])
export const girar = (pts: P[], a: number, cx = 0, cy = 0): P[] => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
}
export const escalarPts = (pts: P[], k: number, cx = 0, cy = 0): P[] => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])

export function poligonoRegular(cx: number, cy: number, r: number, lados: number, giro = 0): P[] {
  const pts: P[] = []
  for (let i = 0; i < lados; i++) {
    const a = giro + (i / lados) * Math.PI * 2
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

export function area(pts: P[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    s += x0 * y1 - x1 * y0
  }
  return s / 2
}

export function caja(pts: P[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

export function cajaDibujo(trazos: Trazo[]) {
  return caja(trazos.flatMap((t) => t.pts))
}

/** ¿El punto está dentro del polígono? (par-impar) */
export function dentro(p: P, pol: P[]) {
  let c = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i]
    const [xj, yj] = pol[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi) c = !c
  }
  return c
}

/** Largo total de corte en mm. */
export function largoCorte(trazos: Trazo[]) {
  let s = 0
  for (const t of trazos) {
    for (let i = 1; i < t.pts.length; i++) s += Math.hypot(t.pts[i][0] - t.pts[i - 1][0], t.pts[i][1] - t.pts[i - 1][1])
    if (t.cerrado && t.pts.length > 2) s += Math.hypot(t.pts[0][0] - t.pts[t.pts.length - 1][0], t.pts[0][1] - t.pts[t.pts.length - 1][1])
  }
  return s
}

/** Curvas de texto (Bézier de opentype, lib/generador/letreros) a tramos rectos. */
export function curvasATrazos(curvas: Curva[], capa = "corte"): Trazo[] {
  return curvas.map((c) => {
    const pts: P[] = [c.inicio]
    let prev = c.inicio
    for (const t of c.tramos) {
      if ("c1" in t) {
        const largo = Math.hypot(t.c1[0] - prev[0], t.c1[1] - prev[1]) + Math.hypot(t.c2[0] - t.c1[0], t.c2[1] - t.c1[1]) + Math.hypot(t.p[0] - t.c2[0], t.p[1] - t.c2[1])
        const n = Math.max(2, Math.min(40, Math.ceil(largo / 0.8)))
        for (let i = 1; i <= n; i++) {
          const u = i / n
          const v = 1 - u
          pts.push([
            v * v * v * prev[0] + 3 * v * v * u * t.c1[0] + 3 * v * u * u * t.c2[0] + u * u * u * t.p[0],
            v * v * v * prev[1] + 3 * v * v * u * t.c1[1] + 3 * v * u * u * t.c2[1] + u * u * u * t.p[1],
          ])
        }
      } else pts.push(t.p)
      prev = t.p
    }
    const ult = pts[pts.length - 1]
    if (pts.length > 2 && Math.hypot(ult[0] - pts[0][0], ult[1] - pts[0][1]) < 1e-6) pts.pop()
    return trazo(pts, true, capa)
  })
}

export const dibujo = (trazos: Trazo[], avisos: string[] = []): Dibujo => ({ trazos, avisos, unidades: "mm" })

/** Acomoda grupos de trazos en hojas (renglones), sin girarlos. */
export function acomodarEnHojas(
  grupos: Trazo[][],
  hoja: { ancho: number; alto: number },
  separacion = 4,
): { trazos: Trazo[]; hojas: number; noCaben: number } {
  const salida: Trazo[] = []
  let hojaN = 0
  let x = separacion
  let y = separacion
  let renglon = 0
  let noCaben = 0
  const desplazamientoHoja = () => hojaN * (hoja.ancho + 30)
  const marcos: number[] = [0]
  for (const g of grupos) {
    const b = cajaDibujo(g)
    const w = b.x1 - b.x0
    const h = b.y1 - b.y0
    if (w + 2 * separacion > hoja.ancho || h + 2 * separacion > hoja.alto) {
      noCaben++
      continue
    }
    if (x + w + separacion > hoja.ancho) {
      x = separacion
      y += renglon + separacion
      renglon = 0
    }
    if (y + h + separacion > hoja.alto) {
      hojaN++
      marcos.push(hojaN)
      x = separacion
      y = separacion
      renglon = 0
    }
    const dx = desplazamientoHoja() + x - b.x0
    const dy = y - b.y0
    for (const t of g) salida.push({ ...t, pts: mover(t.pts, dx, dy) })
    x += w + separacion
    renglon = Math.max(renglon, h)
  }
  for (const n of marcos) salida.push(trazo([[n * (hoja.ancho + 30), 0], [n * (hoja.ancho + 30) + hoja.ancho, 0], [n * (hoja.ancho + 30) + hoja.ancho, hoja.alto], [n * (hoja.ancho + 30), hoja.alto]], true, "hoja"))
  return { trazos: salida, hojas: marcos.length, noCaben }
}
