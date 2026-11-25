// ¿La pieza sale del molde o se atora? Se revisa por columnas verticales: en
// una rejilla sobre la pieza se lanza un rayo de arriba abajo y se anotan los
// tramos donde el rayo va por dentro de la pieza.
//
//   - Molde abierto (la pieza sale hacia arriba): una columna se atora si hay
//     molde encima de la pieza, es decir, si la pieza tiene dos tramos (un
//     hueco con molde en medio) o si su parte de arriba no llega al tope.
//   - Molde de dos partes partido a la altura zp (la mitad de arriba sale hacia
//     arriba y la de abajo hacia abajo): una columna se atora si tiene dos
//     tramos, si la pieza empieza arriba de zp (molde de la mitad de arriba
//     debajo de la pieza) o si termina abajo de zp (molde de la mitad de abajo
//     encima de la pieza).
//
// La misma regla dice si las mitades se pueden maquinar en un CNC de 3 ejes
// desde su cara de partición (o desde arriba, el molde abierto): si nada se
// atora, la fresa ve toda la cavidad. No toma en cuenta el radio de la fresa.
import type { Arriba } from "./moldes"

/**
 * Tramos [entra, sale] de la pieza en cada columna (coordenada "arriba"), ya
 * empezando en 0, y cuántas columnas no se pudieron leer (malla con huecos).
 */
export type Columnas = { tramos: [number, number][][]; alto: number; dudosas: number }

const CELDAS = 80

/**
 * Columnas de la malla vista desde el eje `eje` (0 = x, 1 = y, 2 = z) con
 * "arriba" en el sentido `signo`. Los triángulos se rasterizan en la rejilla y
 * en cada celda se guarda la altura donde el rayo cruza cada triángulo.
 */
export function columnas(tris: ArrayLike<number>, eje: 0 | 1 | 2, signo: 1 | -1, celdas = CELDAS): Columnas {
  const [a, b] = eje === 2 ? [0, 1] : eje === 1 ? [0, 2] : [1, 2]
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let i = 0; i < tris.length; i += 3) {
    const u = tris[i + a], v = tris[i + b], w = signo * tris[i + eje]
    if (u < a0) a0 = u
    if (u > a1) a1 = u
    if (v < b0) b0 = v
    if (v > b1) b1 = v
    if (w < z0) z0 = w
    if (w > z1) z1 = w
  }
  if (!isFinite(a0)) return { tramos: [], alto: 0, dudosas: 0 }
  const lado = Math.max(a1 - a0, b1 - b0) / celdas || 1
  const na = Math.max(1, Math.ceil((a1 - a0) / lado)), nb = Math.max(1, Math.ceil((b1 - b0) / lado))
  // cada cruce: altura y si el rayo (de abajo hacia arriba) entra (+1) o sale (-1)
  const cruces: [number, number][][] = Array.from({ length: na * nb }, () => [])
  // centro de cada celda corrido un poco para no caer justo en aristas o vértices
  const cu = (i: number) => a0 + (i + 0.5013) * lado
  const cv = (j: number) => b0 + (j + 0.4987) * lado
  for (let t = 0; t < tris.length; t += 9) {
    const ux = tris[t + a], uy = tris[t + b], uz = signo * tris[t + eje]
    const vx = tris[t + 3 + a], vy = tris[t + 3 + b], vz = signo * tris[t + 3 + eje]
    const wx = tris[t + 6 + a], wy = tris[t + 6 + b], wz = signo * tris[t + 6 + eje]
    const d = (vy - wy) * (ux - wx) + (wx - vx) * (uy - wy)
    if (Math.abs(d) < 1e-12) continue // triángulo de canto: el rayo no lo cruza
    // componente "arriba" de la normal: (a × b) da +eje, salvo x × z = −y
    const nArriba = ((vx - ux) * (wy - uy) - (vy - uy) * (wx - ux)) * (eje === 1 ? -1 : 1) * signo
    const sentido = nArriba < 0 ? 1 : -1 // cara que mira abajo: por ahí se entra
    const i0 = Math.max(0, Math.floor((Math.min(ux, vx, wx) - a0) / lado - 0.5013))
    const i1 = Math.min(na - 1, Math.ceil((Math.max(ux, vx, wx) - a0) / lado))
    const j0 = Math.max(0, Math.floor((Math.min(uy, vy, wy) - b0) / lado - 0.4987))
    const j1 = Math.min(nb - 1, Math.ceil((Math.max(uy, vy, wy) - b0) / lado))
    for (let i = i0; i <= i1; i++) {
      const x = cu(i)
      for (let j = j0; j <= j1; j++) {
        const y = cv(j)
        const l1 = ((vy - wy) * (x - wx) + (wx - vx) * (y - wy)) / d
        const l2 = ((wy - uy) * (x - wx) + (ux - wx) * (y - wy)) / d
        const l3 = 1 - l1 - l2
        if (l1 < 0 || l2 < 0 || l3 < 0) continue
        cruces[i + na * j].push([l1 * uz + l2 * vz + l3 * wz - z0, sentido])
      }
    }
  }
  // Se cuenta por sentido (dentro = contador distinto de 0), no por pares:
  // dos cuerpos encimados en el mismo archivo cuentan como uno solo
  const tramos: [number, number][][] = []
  let dudosas = 0
  for (const c of cruces) {
    if (!c.length) continue
    c.sort((p, q) => p[0] - q[0] || p[1] - q[1])
    const t: [number, number][] = []
    let dentro = 0, desde = 0, previo: [number, number] | null = null
    for (const x of c) {
      // el rayo tocó una arista compartida: el mismo cruce sale dos veces
      if (previo && x[1] === previo[1] && x[0] - previo[0] < 1e-6) continue
      previo = x
      const antes = dentro
      dentro += x[1]
      if (antes === 0 && dentro !== 0) desde = x[0]
      else if (antes !== 0 && dentro === 0) {
        if (t.length && desde - t[t.length - 1][1] < 1e-6) t[t.length - 1][1] = x[0] // tramos que se tocan: uno solo
        else t.push([desde, x[0]])
      }
    }
    if (dentro !== 0 || !t.length) dudosas++ // la malla no cierra en esta columna
    else tramos.push(t)
  }
  return { tramos, alto: z1 - z0, dudosas }
}

const tolerancia = (alto: number) => Math.max(0.2, alto * 0.005)

/** Fracción (0 a 1) de las columnas de la pieza que se atoran en un molde abierto. */
export function atoradoAbierto(c: Columnas) {
  if (!c.tramos.length) return 0
  const tol = tolerancia(c.alto)
  let malas = 0
  for (const t of c.tramos) if (t.length > 1 || t[t.length - 1][1] < c.alto - tol) malas++
  return malas / c.tramos.length
}

/** Fracción de columnas que se atoran en un molde de dos partes partido a la altura zp (mm). */
export function atoradoDosPartes(c: Columnas, zp: number) {
  if (!c.tramos.length) return 0
  const tol = tolerancia(c.alto)
  let malas = 0
  for (const t of c.tramos) if (t.length > 1 || t[0][0] > zp + tol || t[t.length - 1][1] < zp - tol) malas++
  return malas / c.tramos.length
}

/**
 * Pieza hueca con el núcleo metido desde arriba (ya en su posición de colado):
 * fracción de columnas donde queda pieza encima del hueco, o sea donde el
 * núcleo no puede salir hacia arriba.
 */
export function nucleoAtorado(tris: ArrayLike<number>) {
  const c = columnas(tris, 2, 1)
  if (!c.tramos.length) return 0
  return c.tramos.filter((t) => t.length > 1).length / c.tramos.length
}

/** La altura de partición (en % de la altura) con menos columnas atoradas; empata hacia la más cercana a `cerca`. */
export function mejorParticion(c: Columnas, cerca = 50): { particion: number; atorado: number } {
  let mejor = { particion: cerca, atorado: Infinity }
  for (let p = 5; p <= 95; p++) {
    const a = atoradoDosPartes(c, (c.alto * p) / 100)
    if (a < mejor.atorado - 1e-9 || (Math.abs(a - mejor.atorado) < 1e-9 && Math.abs(p - cerca) < Math.abs(mejor.particion - cerca))) mejor = { particion: p, atorado: a }
  }
  return mejor
}

const LADOS: [Arriba, 0 | 1 | 2, 1 | -1][] = [["z", 2, 1], ["-z", 2, -1], ["y", 1, 1], ["-y", 1, -1], ["x", 0, 1], ["-x", 0, -1]]

export type Desmoldeo = {
  /** Fracción (0 a 1) de la pieza que se atora con las opciones elegidas. */
  atorado: number
  /** No se pudo revisar (la malla tiene huecos o caras volteadas): no se dice nada. */
  dudoso?: boolean
  /** Lo que se atora es el núcleo de la pieza hueca (la boca es más angosta que el interior). */
  nucleo?: boolean
  /** Mejor altura de partición (%) para el lado elegido, si es mejor que la elegida (dos partes). */
  particion?: { particion: number; atorado: number }
  /** Mejor lado hacia arriba, si es mejor que el elegido (con su partición en dos partes). */
  arriba?: { arriba: Arriba; atorado: number; particion?: number }
}

/** Se considera que no se atora por debajo de esto (bordes de la rejilla). */
export const SIN_ATORAR = 0.01

/**
 * Revisa el desmoldeo de la pieza tal como viene (sin girar) para el lado y la
 * partición elegidos, y busca una partición y un lado mejores.
 */
export function revisarDesmoldeo(tris: ArrayLike<number>, tipo: "abierto" | "dos_partes", arriba: Arriba, particion: number): Desmoldeo {
  const lado = LADOS.find((l) => l[0] === arriba) || LADOS[0]
  const cActual = columnas(tris, lado[1], lado[2])
  if (!cActual.tramos.length || cActual.dudosas > 0.2 * (cActual.tramos.length + cActual.dudosas)) return { atorado: 0, dudoso: true }
  const r: Desmoldeo = {
    atorado: tipo === "abierto" ? atoradoAbierto(cActual) : atoradoDosPartes(cActual, (cActual.alto * particion) / 100),
  }
  if (r.atorado <= SIN_ATORAR) return r // sale bien: no hay nada que sugerir
  if (tipo === "dos_partes") {
    const m = mejorParticion(cActual, particion)
    if (m.atorado < r.atorado - SIN_ATORAR) r.particion = m
  }
  const enActual = r.particion ? r.particion.atorado : r.atorado
  if (enActual <= SIN_ATORAR) return r
  // Los otros cinco lados, con su mejor partición en dos partes
  let mejor: Desmoldeo["arriba"]
  for (const [id, eje, signo] of LADOS) {
    if (id === lado[0]) continue
    const c = columnas(tris, eje, signo)
    const o = tipo === "abierto" ? { atorado: atoradoAbierto(c), particion: undefined } : mejorParticion(c)
    if (!mejor || o.atorado < mejor.atorado - 1e-9) mejor = { arriba: id, atorado: o.atorado, particion: o.particion }
  }
  if (mejor && mejor.atorado < enActual - SIN_ATORAR) r.arriba = mejor
  return r
}
