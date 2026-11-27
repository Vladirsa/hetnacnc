// Patrones paramétricos 3D: a un modelo (una maceta, un florero, una pantalla
// de lámpara o lo que suba el cliente en STL/OBJ) se le aplica un patrón en la
// superficie (ondas, espiral, estrías, rombos, panal, Voronoi, burbujas, ruido
// orgánico) y, si se quiere, una torsión. La idea del diseño paramétrico: se
// mueve un número y todo se recalcula.
//
// Cómo funciona:
//   1. Se sueldan los vértices repetidos del STL (cada triángulo trae los suyos)
//      para que la malla sea una sola pieza conectada.
//   2. Se refina: se parte la arista más larga de cada triángulo (y la del
//      vecino que la comparte, así nunca quedan grietas) hasta que ninguna
//      arista mida más que el paso del patrón. Un cono de CAD trae triángulos
//      de 9 cm; el patrón necesita puntos cada milímetro.
//   3. Cada vértice se empuja sobre su normal según el patrón, que se mide en
//      coordenadas cilíndricas alrededor del eje vertical: u = ángulo × radio
//      medio, v = altura, en milímetros. El número de repeticiones en la vuelta
//      es entero, así que el patrón cierra sin costura.
//   4. Sólo se toca la cara de afuera de las paredes (la normal apunta lejos
//      del eje y no hacia arriba o abajo), con un margen liso arriba y abajo.
// Como los vértices sólo se mueven, la malla sigue cerrada.

export type P3 = [number, number, number]

export type PatronId = "ondas" | "espiral" | "estrias" | "rombos" | "panal" | "voronoi" | "burbujas" | "organico"
export const PATRONES: { id: PatronId; nombre: string; nota: string }[] = [
  { id: "ondas", nombre: "Ondas", nota: "Anillos ondulados alrededor." },
  { id: "espiral", nombre: "Espiral", nota: "Ondas que suben girando." },
  { id: "estrias", nombre: "Estrías", nota: "Canales verticales, como columna." },
  { id: "rombos", nombre: "Rombos", nota: "Puntas de diamante (moleteado)." },
  { id: "panal", nombre: "Panal", nota: "Celdas hexagonales con borde." },
  { id: "voronoi", nombre: "Voronoi", nota: "Celdas orgánicas, como piel o espuma." },
  { id: "burbujas", nombre: "Burbujas", nota: "Círculos en relieve acomodados." },
  { id: "organico", nombre: "Orgánico", nota: "Relieve irregular, como piedra." },
]

export type OpcionesPatron = {
  patron: PatronId
  tamano: number // tamaño de una celda o largo de onda (mm)
  profundidad: number // mm: positivo = sale, negativo = se hunde
  margenArriba: number // mm lisos en el borde de arriba
  margenAbajo: number // mm lisos en la base
  soloExterior: boolean
  torsion: number // grados de giro de abajo hacia arriba (0 = sin)
  semilla: number // para Voronoi y orgánico
}

export type MallaSoldada = { pos: Float64Array; idx: Uint32Array }

// ── 1. Soldar ────────────────────────────────────────────────────────────
export function soldar(tris: number[] | Float32Array, tol = 1e-4): MallaSoldada {
  const mapa = new Map<string, number>()
  const pos: number[] = []
  const idx = new Uint32Array(tris.length / 3)
  const q = (v: number) => Math.round(v / tol)
  for (let i = 0; i < tris.length; i += 3) {
    const k = `${q(tris[i])},${q(tris[i + 1])},${q(tris[i + 2])}`
    let n = mapa.get(k)
    if (n === undefined) {
      n = pos.length / 3
      pos.push(tris[i], tris[i + 1], tris[i + 2])
      mapa.set(k, n)
    }
    idx[i / 3] = n
  }
  // fuera triángulos que quedaron con dos vértices iguales
  const limpio: number[] = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]
    if (a !== b && b !== c && a !== c) limpio.push(a, b, c)
  }
  return { pos: Float64Array.from(pos), idx: Uint32Array.from(limpio) }
}

export function areaTotal(m: MallaSoldada): number {
  let s = 0
  const p = m.pos, ix = m.idx
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    s += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return s
}

// ── 2. Refinar sin grietas ───────────────────────────────────────────────
const BIG = 2 ** 26
const llave = (a: number, b: number) => (a < b ? a * BIG + b : b * BIG + a)

/** Parte aristas de más de `max` mm (la más larga primero) hasta que ninguna lo sea o se llegue a `maxTris`. */
export function refinar(m: MallaSoldada, max: number, maxTris = 900_000, importa?: (t: number, pos: number[], tri: number[]) => boolean): MallaSoldada {
  const pos: number[] = Array.from(m.pos)
  const tri: number[] = Array.from(m.idx)
  const aristas = new Map<number, number[]>() // llave → triángulos que la usan
  const agregar = (a: number, b: number, t: number) => {
    const k = llave(a, b)
    const l = aristas.get(k)
    if (l) l.push(t)
    else aristas.set(k, [t])
  }
  const quitar = (a: number, b: number, t: number) => {
    const k = llave(a, b)
    const l = aristas.get(k)
    if (!l) return
    const i = l.indexOf(t)
    if (i >= 0) l.splice(i, 1)
    if (!l.length) aristas.delete(k)
  }
  for (let t = 0; t < tri.length / 3; t++) {
    agregar(tri[t * 3], tri[t * 3 + 1], t)
    agregar(tri[t * 3 + 1], tri[t * 3 + 2], t)
    agregar(tri[t * 3 + 2], tri[t * 3], t)
  }
  const largo2 = (a: number, b: number) => {
    const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2]
    return dx * dx + dy * dy + dz * dz
  }
  const max2 = max * max
  for (let pasada = 0; pasada < 40; pasada++) {
    const largas: [number, number, number][] = []
    for (const [k, usan] of aristas) {
      const a = Math.floor(k / BIG), b = k - a * BIG
      const l = largo2(a, b)
      if (l > max2 && (!importa || usan.some((t) => importa(t, pos, tri)))) largas.push([l, a, b])
    }
    if (!largas.length) break
    largas.sort((x, y) => y[0] - x[0])
    for (const [, a, b] of largas) {
      if (tri.length / 3 >= maxTris) break
      const usan = aristas.get(llave(a, b))
      if (!usan || largo2(a, b) <= max2) continue
      const m = pos.length / 3
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2)
      for (const t of [...usan]) {
        // el triángulo como (p, q, r) con la arista partida en p→q
        let p = tri[t * 3], q = tri[t * 3 + 1], r = tri[t * 3 + 2]
        if ((p === a && q === b) || (p === b && q === a)) {
          /* ya */
        } else if ((q === a && r === b) || (q === b && r === a)) {
          ;[p, q, r] = [q, r, p]
        } else {
          ;[p, q, r] = [r, p, q]
        }
        const t2 = tri.length / 3
        quitar(p, q, t)
        quitar(q, r, t)
        tri[t * 3] = p
        tri[t * 3 + 1] = m
        tri[t * 3 + 2] = r
        tri.push(m, q, r)
        agregar(p, m, t)
        agregar(m, r, t)
        agregar(m, q, t2)
        agregar(q, r, t2)
        agregar(r, m, t2)
      }
    }
    if (tri.length / 3 >= maxTris) break
  }
  return { pos: Float64Array.from(pos), idx: Uint32Array.from(tri) }
}

// ── 3. Patrones (u, v en mm; periodo en u = vuelta completa) ─────────────
function hash(i: number, j: number, s: number): number {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Valor del patrón entre 0 (fondo) y 1 (lo más alto). nU = celdas en la vuelta. */
function patron(id: PatronId, u: number, v: number, L: number, nU: number, tam: number, semilla: number): number {
  const cu = L / nU // ancho real de una celda (cabe exacto en la vuelta)
  const fu = u / cu, fv = v / tam
  switch (id) {
    case "ondas":
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * fv)
    case "espiral":
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * (fu + fv))
    case "estrias":
      return Math.pow(Math.abs(Math.sin(Math.PI * fu)), 0.6)
    case "rombos": {
      const a = Math.abs(((fu + fv) % 1 + 1) % 1 - 0.5) * 2
      const b = Math.abs(((fu - fv) % 1 + 1) % 1 - 0.5) * 2
      return 1 - Math.max(a, b)
    }
    case "panal": {
      // distancia al borde de la celda hexagonal (celda de ancho cu)
      const s = cu / Math.sqrt(3)
      const x = u, y = v
      const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / s
      const r = ((2 / 3) * y) / s
      let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r)
      const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r)
      if (dx > dy && dx > dz) rx = -ry - rz
      else if (dy > dz) ry = -rx - rz
      else rz = -rx - ry
      const fx = q - rx, fz = r - rz
      const d = Math.max(Math.abs(fx), Math.abs(fz), Math.abs(fx + fz)) // 0 centro … 1 borde (aprox.)
      return suave(0.62, 0.9, d * 2)
    }
    case "voronoi": {
      const nV = 1
      void nV
      const i0 = Math.floor(fu), j0 = Math.floor(fv)
      let d1 = 9, d2 = 9
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const i = i0 + di, j = j0 + dj
          const iw = ((i % nU) + nU) % nU // la vuelta cierra
          const px = i + 0.15 + 0.7 * hash(iw, j, semilla)
          const py = j + 0.15 + 0.7 * hash(iw, j, semilla + 7)
          const d = Math.hypot((fu - px) * (cu / tam), fv - py)
          if (d < d1) {
            d2 = d1
            d1 = d
          } else if (d < d2) d2 = d
        }
      return 1 - suave(0, 0.16, d2 - d1) // bordes altos
    }
    case "burbujas": {
      const fila = Math.floor(fv)
      const corr = fila % 2 ? 0.5 : 0
      const cx = Math.floor(fu - corr) + 0.5 + corr
      const d = Math.hypot((fu - cx) * (cu / tam), fv - (fila + 0.5))
      return Math.sqrt(Math.max(0, 1 - (d / 0.42) ** 2))
    }
    case "organico": {
      // ruido de valor periódico en u, dos octavas
      let s = 0, a = 1, tot = 0
      for (let o = 0; o < 3; o++) {
        const k = 2 ** o
        const x = fu * k, y = fv * k, n = nU * k
        const i = Math.floor(x), j = Math.floor(y)
        const tx = x - i, ty = y - j
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
        const w = (ii: number, jj: number) => hash(((ii % n) + n) % n, jj, semilla + o * 31)
        const v0 = w(i, j) + (w(i + 1, j) - w(i, j)) * sx
        const v1 = w(i, j + 1) + (w(i + 1, j + 1) - w(i, j + 1)) * sx
        s += a * (v0 + (v1 - v0) * sy)
        tot += a
        a *= 0.5
      }
      return s / tot
    }
  }
}

// ── 4. Aplicar ───────────────────────────────────────────────────────────
export type Resultado = { tris: number[]; medidas: P3; vuelta: number; celdas: number; avisos: string[] }

function normales(m: MallaSoldada): Float64Array {
  const n = new Float64Array(m.pos.length)
  const p = m.pos, ix = m.idx
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx // ya pesa por área
    for (const k of [a, b, c]) {
      n[k] += nx
      n[k + 1] += ny
      n[k + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
  return n
}

export function aplicarPatron(m: MallaSoldada, o: OpcionesPatron): Resultado {
  const avisos: string[] = []
  const p = m.pos
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i])
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1])
    z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2])
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, H = Math.max(1e-6, z1 - z0)
  const n = normales(m)
  // radio medio de la cara de afuera (para que las celdas midan lo pedido en mm)
  let rs = 0, cnt = 0
  for (let i = 0; i < p.length; i += 3) {
    const rx = p[i] - cx, ry = p[i + 1] - cy, r = Math.hypot(rx, ry)
    if (r > 1e-6 && (n[i] * rx + n[i + 1] * ry) / r > 0.5) {
      rs += r
      cnt++
    }
  }
  const Rm = cnt ? rs / cnt : Math.max(x1 - x0, y1 - y0) / 2
  const L = 2 * Math.PI * Rm
  const tam = Math.max(1, o.tamano)
  const nU = Math.max(3, Math.round(L / tam))
  if (Math.abs(o.profundidad) > tam * 0.6) avisos.push("La profundidad es grande para el tamaño del patrón: pueden salir picos delgados. Sube el tamaño o baja la profundidad.")

  const out = new Float64Array(p.length)
  const tw = (o.torsion * Math.PI) / 180
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i], y = p[i + 1]
    const z = p[i + 2]
    const rx = x - cx, ry = y - cy, r = Math.hypot(rx, ry)
    // ¿cara de afuera de una pared?
    const lateral = 1 - suave(0.55, 0.85, Math.abs(n[i + 2]))
    const afuera = o.soloExterior ? (r > 1e-6 ? suave(0.1, 0.4, (n[i] * rx + n[i + 1] * ry) / r) : 0) : 1
    const borde = suave(z0 + o.margenAbajo, z0 + o.margenAbajo + Math.min(4, tam / 2), z) * (1 - suave(z1 - o.margenArriba - Math.min(4, tam / 2), z1 - o.margenArriba, z))
    const peso = lateral * afuera * borde
    if (peso > 0.001 && o.profundidad) {
      const ang = Math.atan2(ry, rx)
      const u = ((ang + Math.PI) / (2 * Math.PI)) * L
      const val = patron(o.patron, u, z - z0, L, nU, tam, o.semilla)
      const d = o.profundidad * peso * (o.profundidad > 0 ? val : 1 - val)
      x += n[i] * d
      y += n[i + 1] * d
      out[i + 2] = z + n[i + 2] * d
    } else out[i + 2] = z
    // torsión alrededor del eje
    if (tw) {
      const a = (tw * (z - z0)) / H
      const c = Math.cos(a), s = Math.sin(a)
      const dx = x - cx, dy = y - cy
      x = cx + dx * c - dy * s
      y = cy + dx * s + dy * c
    }
    out[i] = x
    out[i + 1] = y
  }
  const ix = m.idx
  const tris = new Array<number>(ix.length * 3)
  for (let t = 0; t < ix.length; t++) {
    const k = ix[t] * 3
    tris[t * 3] = out[k] - cx
    tris[t * 3 + 1] = out[k + 1] - cy
    tris[t * 3 + 2] = out[k + 2] - z0
  }
  // medidas ya con el relieve (que sobresale de la caja del modelo base)
  let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity, az = Infinity, bz = -Infinity
  for (let i = 0; i < out.length; i += 3) {
    if (out[i] < ax) ax = out[i]
    if (out[i] > bx) bx = out[i]
    if (out[i + 1] < ay) ay = out[i + 1]
    if (out[i + 1] > by) by = out[i + 1]
    if (out[i + 2] < az) az = out[i + 2]
    if (out[i + 2] > bz) bz = out[i + 2]
  }
  return { tris, medidas: [bx - ax, by - ay, bz - az], vuelta: L, celdas: nU, avisos }
}

/** El patrón desenrollado como placa en relieve (para router CNC o para ver el patrón plano). */
export function relievePlano(o: OpcionesPatron, vuelta: number, alto: number, base = 3, paso = 0.5): number[] {
  const tam = Math.max(1, o.tamano)
  const nU = Math.max(3, Math.round(vuelta / tam))
  const W = vuelta, Hh = alto
  const nx = Math.max(2, Math.min(1200, Math.round(W / paso))), ny = Math.max(2, Math.min(1200, Math.round(Hh / paso)))
  const prof = Math.abs(o.profundidad)
  const h = (i: number, j: number) => {
    const u = (i / nx) * W, v = (j / ny) * Hh
    const val = patron(o.patron, u, v, W, nU, tam, o.semilla)
    return base + prof * (o.profundidad >= 0 ? val : 1 - val)
  }
  const t: number[] = []
  const P = (i: number, j: number, z: number): P3 => [(i / nx) * W, (j / ny) * Hh, z]
  const quad = (a: P3, b: P3, c: P3, d: P3) => t.push(...a, ...b, ...c, ...a, ...c, ...d)
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      quad(P(i, j, h(i, j)), P(i + 1, j, h(i + 1, j)), P(i + 1, j + 1, h(i + 1, j + 1)), P(i, j + 1, h(i, j + 1)))
      quad(P(i, j, 0), P(i, j + 1, 0), P(i + 1, j + 1, 0), P(i + 1, j, 0))
    }
  // paredes
  for (let i = 0; i < nx; i++) {
    quad(P(i, 0, 0), P(i + 1, 0, 0), P(i + 1, 0, h(i + 1, 0)), P(i, 0, h(i, 0)))
    quad(P(i + 1, ny, 0), P(i, ny, 0), P(i, ny, h(i, ny)), P(i + 1, ny, h(i + 1, ny)))
  }
  for (let j = 0; j < ny; j++) {
    quad(P(0, j + 1, 0), P(0, j, 0), P(0, j, h(0, j)), P(0, j + 1, h(0, j + 1)))
    quad(P(nx, j, 0), P(nx, j + 1, 0), P(nx, j + 1, h(nx, j + 1)), P(nx, j, h(nx, j)))
  }
  return t
}

// ── Modelos para empezar (sólidos cerrados, de revolución) ───────────────
export type ModeloInicio = "florero" | "pantalla" | "portavelas" | "maceta-recta"
export const MODELOS_INICIO: { id: ModeloInicio; nombre: string }[] = [
  { id: "florero", nombre: "Florero" },
  { id: "pantalla", nombre: "Pantalla de lámpara" },
  { id: "portavelas", nombre: "Portavelas" },
  { id: "maceta-recta", nombre: "Maceta recta" },
]

/** Sólido de revolución hueco: perfil exterior r(z), pared, fondo (0 = abierto abajo). */
export function revolucion(perfil: (t: number) => number, alto: number, pared: number, fondo: number, lados = 96, filas = 60): number[] {
  const t: number[] = []
  const anillo = (r: number, z: number) => Array.from({ length: lados }, (_, k) => [r * Math.cos((2 * Math.PI * k) / lados), r * Math.sin((2 * Math.PI * k) / lados), z] as P3)
  const ext: P3[][] = [], int: P3[][] = []
  for (let f = 0; f <= filas; f++) {
    const z = (f / filas) * alto
    ext.push(anillo(perfil(f / filas), z))
    // adentro: de lo alto del fondo hasta arriba, sin filas encimadas
    const zi = fondo + ((alto - fondo) * f) / filas
    int.push(anillo(Math.max(0.5, perfil(zi / alto) - pared), zi))
  }
  const quad = (a: P3, b: P3, c: P3, d: P3) => t.push(...a, ...b, ...c, ...a, ...c, ...d)
  for (let f = 0; f < filas; f++)
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados
      quad(ext[f][k], ext[f][k2], ext[f + 1][k2], ext[f + 1][k]) // afuera
      quad(int[f][k2], int[f][k], int[f + 1][k], int[f + 1][k2]) // adentro (normal hacia el eje)
    }
  // borde de arriba
  for (let k = 0; k < lados; k++) {
    const k2 = (k + 1) % lados
    quad(ext[filas][k], ext[filas][k2], int[filas][k2], int[filas][k])
  }
  // abajo: con fondo, tapa de afuera y piso de adentro; sin fondo, anillo
  if (fondo > 0) {
    const c0: P3 = [0, 0, 0], c1: P3 = [0, 0, fondo]
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados
      t.push(...c0, ...ext[0][k2], ...ext[0][k])
      t.push(...c1, ...int[0][k], ...int[0][k2])
    }
  } else
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados
      quad(ext[0][k2], ext[0][k], int[0][k], int[0][k2])
    }
  return t
}

export function modeloInicio(id: ModeloInicio, escala = 1): number[] {
  const e = escala
  switch (id) {
    case "florero":
      return revolucion((t) => e * (32 + 16 * Math.sin(Math.PI * (t * 1.1 - 0.05)) - 10 * t * t), 180 * e, 2.4, 2.4)
    case "pantalla":
      return revolucion((t) => e * (75 - 30 * t), 160 * e, 2, 0)
    case "portavelas":
      return revolucion(() => e * 40, 80 * e, 2.4, 3)
    case "maceta-recta":
      return revolucion((t) => e * (55 + 8 * t), 110 * e, 2.6, 3)
  }
}

/** ¿El triángulo es de la cara de afuera de una pared? (normal horizontal y lejos del eje cx, cy) */
export function caraExterior(cx: number, cy: number) {
  return (t: number, pos: number[], tri: number[]) => {
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1
    if (Math.abs(nz / l) > 0.85) return false
    const mx = (pos[a] + pos[b] + pos[c]) / 3 - cx, my = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy
    return nx * mx + ny * my > 0
  }
}

/** Centro (X, Y) de la caja del modelo: el eje del patrón. */
export function ejeDe(m: MallaSoldada): [number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (let i = 0; i < m.pos.length; i += 3) {
    x0 = Math.min(x0, m.pos[i]); x1 = Math.max(x1, m.pos[i])
    y0 = Math.min(y0, m.pos[i + 1]); y1 = Math.max(y1, m.pos[i + 1])
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

/** Paso de refinado para un tamaño de patrón: unos 8 puntos por celda, entre 0.6 y 2 mm. */
export const pasoPara = (tamano: number) => Math.min(2, Math.max(0.6, tamano / 8))
