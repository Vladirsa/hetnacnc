// Patrón Voronoi (2D Studio › Patrones de corte): celdas irregulares, como las
// de un panal desordenado o la piel de una jirafa, para celosías, lámparas,
// separadores, mesas y regalos en láser, router o plasma.
//
// Cómo se hace, sin librerías: se reparten puntos en el área (con una semilla,
// así cada "variación" se puede repetir), se emparejan un poco (relajación de
// Lloyd) y cada celda es el polígono de los lugares más cercanos a su punto:
// el área recortada por las mediatrices con los puntos vecinos. Después cada
// celda se encoge medio puente (lo que queda de material entre dos huecos) y,
// si se pide, se le redondean las esquinas.
//
// Dos resultados:
//   - "calado": panel con marco y las celdas como huecos (celosía).
//   - "mosaico": las celdas como piezas sueltas, para armar un mosaico de colores.
import { type P, type Trazo, circulo, dibujo, rect, trazo } from "@/lib/generador/geo2d"

export type FormaVoronoi = "rectangulo" | "circulo"
export type DensidadVoronoi = "pareja" | "centro" | "orilla" | "abajo"
export type ResultadoVoronoi = "calado" | "mosaico"

export type OpcionesVoronoi = {
  forma: FormaVoronoi
  ancho: number // mm (en círculo, el diámetro)
  alto: number // mm (no se usa en círculo)
  marco: number // mm de borde sin calar (sólo calado)
  celdas: number // cuántas celdas, aproximado
  puente: number // mm de material entre dos huecos (en mosaico, la separación entre piezas)
  redondeo: number // mm de radio en las esquinas de cada celda
  orden: number // 0 = al azar … 1 = muy parejas
  densidad: DensidadVoronoi
  semilla: number
  resultado: ResultadoVoronoi
  radio: number // esquinas del panel (rectángulo)
}

export const MAX_CELDAS = 800

// Números al azar que se pueden repetir (mulberry32)
export function azar(semilla: number) {
  let a = semilla >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Polígonos convexos ─────────────────────────────────────────────────────

/** Recorta un polígono convexo con el semiplano a·x + b·y <= c (Sutherland–Hodgman). */
export function recortar(pol: P[], a: number, b: number, c: number): P[] {
  const out: P[] = []
  const n = pol.length
  for (let i = 0; i < n; i++) {
    const p = pol[i]
    const q = pol[(i + 1) % n]
    const fp = a * p[0] + b * p[1] - c
    const fq = a * q[0] + b * q[1] - c
    if (fp <= 0) out.push(p)
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq)
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  }
  return out
}

export function areaPol(pol: P[]) {
  let s = 0
  for (let i = 0; i < pol.length; i++) {
    const [x0, y0] = pol[i]
    const [x1, y1] = pol[(i + 1) % pol.length]
    s += x0 * y1 - x1 * y0
  }
  return s / 2
}

function centroide(pol: P[]): P {
  let cx = 0
  let cy = 0
  let a = 0
  for (let i = 0; i < pol.length; i++) {
    const [x0, y0] = pol[i]
    const [x1, y1] = pol[(i + 1) % pol.length]
    const f = x0 * y1 - x1 * y0
    a += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  if (Math.abs(a) < 1e-9) return pol[0] || [0, 0]
  return [cx / (3 * a), cy / (3 * a)]
}

/** Pone el polígono en sentido antihorario. */
const ccw = (pol: P[]) => (areaPol(pol) < 0 ? [...pol].reverse() : pol)

/** Encoge un polígono convexo (antihorario) d mm hacia adentro. */
export function encoger(pol: P[], d: number): P[] {
  if (d <= 0) return pol
  let out = ccw(pol)
  const base = ccw(pol)
  for (let i = 0; i < base.length && out.length >= 3; i++) {
    const [x0, y0] = base[i]
    const [x1, y1] = base[(i + 1) % base.length]
    const ex = x1 - x0
    const ey = y1 - y0
    const L = Math.hypot(ex, ey)
    if (L < 1e-9) continue
    // Normal hacia afuera de un polígono antihorario: (ey, -ex)
    const nx = ey / L
    const ny = -ex / L
    out = recortar(out, nx, ny, nx * x0 + ny * y0 - d)
  }
  return out.length >= 3 && Math.abs(areaPol(out)) > 1e-6 ? out : []
}

/** Agranda un polígono convexo (antihorario) r mm con esquinas redondas. */
export function redondear(pol: P[], r: number): P[] {
  if (r <= 0) return pol
  const base = ccw(pol)
  const n = base.length
  const out: P[] = []
  const normal = (i: number): P => {
    const [x0, y0] = base[i]
    const [x1, y1] = base[(i + 1) % n]
    const L = Math.hypot(x1 - x0, y1 - y0) || 1
    return [(y1 - y0) / L, -(x1 - x0) / L]
  }
  for (let i = 0; i < n; i++) {
    const [px, py] = base[i]
    const a0 = Math.atan2(...(([nx, ny]) => [ny, nx] as [number, number])(normal((i - 1 + n) % n)))
    let a1 = Math.atan2(...(([nx, ny]) => [ny, nx] as [number, number])(normal(i)))
    while (a1 < a0) a1 += Math.PI * 2
    const pasos = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 12)))
    for (let k = 0; k <= pasos; k++) {
      const a = a0 + ((a1 - a0) * k) / pasos
      out.push([px + r * Math.cos(a), py + r * Math.sin(a)])
    }
  }
  return out
}

/** Contorno del área como polígono convexo antihorario. */
function contorno(o: OpcionesVoronoi, margen: number): P[] {
  if (o.forma === "circulo") {
    const R = Math.max(5, o.ancho / 2 - margen)
    const n = 96
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [o.ancho / 2 + R * Math.cos(a), o.ancho / 2 + R * Math.sin(a)] as P
    })
  }
  // Con esquinas redondas, el área de las celdas también lleva su esquina
  // redonda (si no, los huecos de las esquinas se salen del panel)
  return rect(margen, margen, o.ancho - margen, o.alto - margen, Math.max(0, o.radio - margen)).pts
}

function dentroConvexo([x, y]: P, pol: P[]) {
  for (let i = 0; i < pol.length; i++) {
    const [x0, y0] = pol[i]
    const [x1, y1] = pol[(i + 1) % pol.length]
    if ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) < 0) return false
  }
  return true
}

// ── Celdas ─────────────────────────────────────────────────────────────────

/** Celdas de Voronoi de los puntos, recortadas al área (convexa). */
export function celdasVoronoi(puntos: P[], area: P[]): P[][] {
  const base = ccw(area)
  if (!puntos.length) return []
  // Rejilla para encontrar vecinos sin revisar todos los puntos: se recorre por
  // anillos de casillas, del más cercano al más lejano, y se para cuando el
  // anillo ya está más lejos que el doble del radio de la celda.
  const xs = base.map((v) => v[0])
  const ys = base.map((v) => v[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const lado = Math.max(1e-6, Math.sqrt(((Math.max(...xs) - x0) * (Math.max(...ys) - y0)) / puntos.length))
  const nx = Math.max(1, Math.ceil((Math.max(...xs) - x0) / lado) + 1)
  const ny = Math.max(1, Math.ceil((Math.max(...ys) - y0) / lado) + 1)
  const casillas: number[][] = Array.from({ length: nx * ny }, () => [])
  const casilla = (p: P) => [Math.min(nx - 1, Math.max(0, Math.floor((p[0] - x0) / lado))), Math.min(ny - 1, Math.max(0, Math.floor((p[1] - y0) / lado)))]
  puntos.forEach((p, i) => {
    const [cx, cy] = casilla(p)
    casillas[cy * nx + cx].push(i)
  })
  return puntos.map((p, i) => {
    const [cx, cy] = casilla(p)
    let cel = base
    const radio2 = () => {
      let r2 = 0
      for (const v of cel) r2 = Math.max(r2, (v[0] - p[0]) ** 2 + (v[1] - p[1]) ** 2)
      return r2
    }
    for (let k = 0; k < Math.max(nx, ny); k++) {
      // El anillo k está a al menos (k-1)·lado del punto
      if (k > 1 && ((k - 1) * lado) ** 2 > 4 * radio2()) break
      const anillo: { q: P; d: number }[] = []
      for (let gy = cy - k; gy <= cy + k; gy++) {
        if (gy < 0 || gy >= ny) continue
        for (let gx = cx - k; gx <= cx + k; gx++) {
          if (gx < 0 || gx >= nx) continue
          if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== k) continue
          for (const j of casillas[gy * nx + gx]) {
            if (j === i) continue
            const q = puntos[j]
            const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2
            if (d < 1e-12) continue // punto repetido: no recorta
            anillo.push({ q, d })
          }
        }
      }
      anillo.sort((a, b) => a.d - b.d)
      for (const { q, d } of anillo) {
        if (d > 4 * radio2()) continue
        // Mediatriz: más cerca de p que de q  ⇔  (q-p)·x <= (|q|²-|p|²)/2
        const a = q[0] - p[0]
        const b = q[1] - p[1]
        const c = (q[0] * q[0] + q[1] * q[1] - p[0] * p[0] - p[1] * p[1]) / 2
        cel = recortar(cel, a, b, c)
        if (cel.length < 3) return []
      }
    }
    return cel
  })
}

/** Densidad relativa (0..1) para repartir más celdas en una zona. */
function peso(densidad: DensidadVoronoi, [x, y]: P, cx: number, cy: number, rmax: number, alto: number) {
  const d = Math.hypot(x - cx, y - cy) / (rmax || 1)
  if (densidad === "centro") return 0.12 + 0.88 * (1 - Math.min(1, d)) ** 2
  if (densidad === "orilla") return 0.12 + 0.88 * Math.min(1, d) ** 2
  if (densidad === "abajo") return 0.12 + 0.88 * (1 - Math.min(1, y / (alto || 1))) ** 2
  return 1
}

export function repartirPuntos(o: OpcionesVoronoi, area: P[]): P[] {
  const rnd = azar(o.semilla)
  const xs = area.map((v) => v[0])
  const ys = area.map((v) => v[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rmax = Math.hypot(x1 - cx, y1 - cy)
  const n = Math.max(3, Math.min(MAX_CELDAS, Math.round(o.celdas)))
  const pts: P[] = []
  for (let intentos = 0; pts.length < n && intentos < n * 200; intentos++) {
    const p: P = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)]
    if (!dentroConvexo(p, ccw(area))) continue
    if (rnd() > peso(o.densidad, p, cx, cy, rmax, o.alto)) continue
    if (pts.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) continue
    pts.push(p)
  }
  // Relajación de Lloyd: cada punto se mueve al centro de su celda. Con
  // densidad no pareja se relaja poco, para no borrar la diferencia.
  const vueltas = Math.round(Math.max(0, Math.min(1, o.orden)) * (o.densidad === "pareja" ? 6 : 2))
  let actuales = pts
  for (let k = 0; k < vueltas; k++) {
    const cel = celdasVoronoi(actuales, area)
    actuales = actuales.map((p, i) => (cel[i].length >= 3 ? centroide(cel[i]) : p))
  }
  return actuales
}

// ── El diseño ──────────────────────────────────────────────────────────────

export function hacerVoronoi(o: OpcionesVoronoi) {
  const avisos: string[] = []
  const circ = o.forma === "circulo"
  const W = Math.max(20, o.ancho)
  const H = circ ? W : Math.max(20, o.alto)
  const op = { ...o, ancho: W, alto: H }
  const calado = o.resultado === "calado"
  const marco = calado ? Math.max(0, Math.min(o.marco, Math.min(W, H) / 2 - 5)) : 0
  const puente = Math.max(0.2, o.puente)
  const redondeo = Math.max(0, o.redondeo)

  const area = contorno(op, marco)
  const puntos = repartirPuntos(op, area)
  const celdas = celdasVoronoi(puntos, area)

  const trazos: Trazo[] = []
  if (calado) trazos.push(circ ? circulo(W / 2, W / 2, W / 2) : rect(0, 0, W, H, o.radio))

  let piezas = 0
  let chicas = 0
  for (const cel of celdas) {
    if (cel.length < 3) continue
    // En calado, las celdas pegadas al marco también dejan medio puente contra él
    const hueco = encoger(cel, puente / 2 + redondeo)
    if (hueco.length < 3) {
      chicas++
      continue
    }
    const forma = redondear(hueco, redondeo)
    trazos.push(trazo(forma, true, "corte"))
    piezas++
  }

  if (calado && marco < 3) avisos.push("El marco es muy angosto: el panel puede quedar frágil en la orilla. Déjalo de 10 mm o más.")
  if (chicas) avisos.push(`${chicas} celda(s) quedaron más chicas que el puente y no se cortan. Usa menos celdas o un puente más delgado.`)
  if (piezas === 0) avisos.push("No cabe ninguna celda: usa menos celdas, un puente más delgado o un panel más grande.")
  if (calado && puente < 2) avisos.push("Puentes de menos de 2 mm se rompen fácil en MDF; en acrílico o metal sí aguantan.")
  if (!calado && puente < 0.3) avisos.push("Deja al menos el ancho de corte del láser (unos 0.2 mm) entre piezas.")

  return { dibujo: dibujo(trazos, avisos), piezas, avisos }
}
