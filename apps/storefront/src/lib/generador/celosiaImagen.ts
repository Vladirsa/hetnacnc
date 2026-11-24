// Celosía desde imagen (2D Studio › Patrones de corte): el cliente sube la foto o
// captura de la celosía que vio en internet y sale el panel listo para plasma,
// láser o router.
//
// Pasos (todo en el navegador, la imagen no sale del equipo):
//   1. Enderezar: las 4 esquinas que marca el cliente se llevan a un rectángulo
//      (homografía), del tamaño del área calada del panel.
//   2. Gris → umbral → máscara de huecos (lo que se corta: lo oscuro o lo claro).
//   3. Reglas del proceso, en milímetros, con transformada de distancia:
//        - huecos más angostos que el mínimo (o con esquinas que la fresa no
//          alcanza) se quitan: apertura de los huecos con radio hueco/2;
//        - puentes (material entre huecos) más delgados que el mínimo se
//          engruesan sólo donde son delgados;
//        - islas (material que quedaría suelto y se cae) se unen al marco con
//          un puente, se quitan o se dejan sueltas.
//   4. Contornos de los huecos (vectorizador, lib/generador/trazado) → mm,
//      más el contorno del panel y los barrenos.
import { type P, type Trazo, circulo, curvasATrazos, dibujo, rect } from "@/lib/generador/geo2d"
import { type Imagen, curvasDeMascara, desenfocar, gris, umbralAutomatico } from "@/lib/generador/trazado"

export type Proceso = "plasma" | "laser" | "router"
export type Islas = "puentes" | "quitar" | "sueltas"

export type OpcionesCelosiaImagen = {
  esquinas: [P, P, P, P] // en píxeles de la imagen: arriba-izq, arriba-der, abajo-der, abajo-izq
  ancho: number // mm del panel
  alto: number // mm del panel
  marco: number // mm sin calar alrededor
  /** Lo que se cortaría y toca la orilla de la foto es fondo (pared, mesa): se deja como material */
  fondo: boolean
  /**
   * Repetir: las 4 esquinas marcan UN módulo y se repite columnas × filas veces
   * para llenar el panel. espejo = cada módulo vecino se voltea (para cuando
   * la imagen es un cuarto o medio motivo). null = la imagen es el panel entero.
   */
  repetir: { columnas: number; filas: number; espejo: boolean } | null
  cortar: "oscuro" | "claro"
  umbral: number | null // 0–255; null = automático
  proceso: Proceso
  puenteMin: number // mm
  huecoMin: number // mm
  islas: Islas
  barrenos: boolean
  diametroBarreno: number
}

/** Mínimos sugeridos según el proceso y el espesor (mm). */
export function minimosSugeridos(proceso: Proceso, espesor: number, fresa = 3.175) {
  const e = Math.max(0.5, espesor)
  if (proceso === "plasma") return { puente: Math.max(3, e), hueco: Math.max(3, e) }
  if (proceso === "router") return { puente: Math.max(3, e * 0.5), hueco: Math.max(fresa, 1) }
  return { puente: Math.max(1.5, e * 0.5), hueco: Math.max(1, e * 0.5) }
}

// ── Homografía (enderezar) ─────────────────────────────────────────────────

/** Resuelve A·x = b (8×8) por eliminación de Gauss. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((f, i) => [...f, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-12) return null
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((f, i) => f[n] / f[i])
}

/** Homografía que lleva (0,0),(1,0),(1,1),(0,1) a las 4 esquinas. */
export function homografia(q: [P, P, P, P]): number[] | null {
  const src: P[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = q[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  const h = resolver(A, b)
  return h ? [...h, 1] : null
}

/** Endereza el gris de la imagen al rectángulo de w×h píxeles. */
export function enderezar(g: Uint8Array, iw: number, ih: number, q: [P, P, P, P], w: number, h: number): Uint8Array {
  const H = homografia(q)
  const out = new Uint8Array(w * h).fill(255)
  if (!H) return out
  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) / w
      const den = H[6] * sx + H[7] * sy + H[8]
      if (!(den > 1e-12)) continue
      const u = (H[0] * sx + H[1] * sy + H[2]) / den - 0.5
      const v = (H[3] * sx + H[4] * sy + H[5]) / den - 0.5
      if (!(u >= 0 && v >= 0 && u <= iw - 1 && v <= ih - 1)) continue
      const x0 = Math.floor(u)
      const y0 = Math.floor(v)
      const x1 = Math.min(iw - 1, x0 + 1)
      const y1 = Math.min(ih - 1, y0 + 1)
      const fx = u - x0
      const fy = v - y0
      const a = g[y0 * iw + x0] * (1 - fx) + g[y0 * iw + x1] * fx
      const c = g[y1 * iw + x0] * (1 - fx) + g[y1 * iw + x1] * fx
      out[y * w + x] = Math.round(a * (1 - fy) + c * fy)
    }
  }
  return out
}

/** Las 4 esquinas forman un cuadrilátero convexo, sin cruzarse y con área. */
export function esquinasValidas(q: [P, P, P, P]): boolean {
  let signo = 0
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i]
    const [bx, by] = q[(i + 1) % 4]
    const [cx, cy] = q[(i + 2) % 4]
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (Math.abs(z) < 1e-6) return false
    const sz = Math.sign(z)
    if (signo && sz !== signo) return false
    signo = sz
  }
  const area = Math.abs(q.reduce((a, [x, y], i) => a + x * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * y, 0)) / 2
  return area >= 100 // px² de la imagen
}

// ── Morfología con transformada de distancia (Felzenszwalb) ────────────────

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) ** 2 + f[v[k]]
  }
}

/** Distancia al cuadrado (px²) de cada píxel al píxel más cercano con m = 1. */
export function distancia2(m: Uint8Array, w: number, h: number): Float64Array {
  const INF = 1e20
  const D = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) D[i] = m[i] ? 0 : INF
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = D[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) D[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = D[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) D[y * w + x] = d[x]
  }
  return D
}

const dilatar = (m: Uint8Array, w: number, h: number, r: number) => {
  if (r <= 0) return m.slice()
  const D = distancia2(m, w, h)
  const r2 = r * r
  return Uint8Array.from(D, (x) => (x <= r2 ? 1 : 0))
}
const negar = (m: Uint8Array) => Uint8Array.from(m, (x) => (x ? 0 : 1))
const erosionar = (m: Uint8Array, w: number, h: number, r: number) => (r <= 0 ? m.slice() : negar(dilatar(negar(m), w, h, r)))
export const abrir = (m: Uint8Array, w: number, h: number, r: number) => dilatar(erosionar(m, w, h, r), w, h, r)

/** Componentes conexas (4 vecinos) de m = 1. Devuelve la etiqueta de cada píxel (0 = fondo). */
export function componentes(m: Uint8Array, w: number, h: number): { etiqueta: Int32Array; n: number } {
  const etiqueta = new Int32Array(w * h)
  let n = 0
  const pila: number[] = []
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || etiqueta[i]) continue
    n++
    etiqueta[i] = n
    pila.push(i)
    while (pila.length) {
      const p = pila.pop()!
      const x = p % w
      const y = (p - x) / w
      if (x > 0 && m[p - 1] && !etiqueta[p - 1]) { etiqueta[p - 1] = n; pila.push(p - 1) }
      if (x < w - 1 && m[p + 1] && !etiqueta[p + 1]) { etiqueta[p + 1] = n; pila.push(p + 1) }
      if (y > 0 && m[p - w] && !etiqueta[p - w]) { etiqueta[p - w] = n; pila.push(p - w) }
      if (y < h - 1 && m[p + w] && !etiqueta[p + w]) { etiqueta[p + w] = n; pila.push(p + w) }
    }
  }
  return { etiqueta, n }
}

/** Pinta un disco de radio r (px) en m. */
function disco(m: Uint8Array, w: number, h: number, cx: number, cy: number, r: number) {
  const ri = Math.ceil(r)
  for (let y = Math.max(0, cy - ri); y <= Math.min(h - 1, cy + ri); y++)
    for (let x = Math.max(0, cx - ri); x <= Math.min(w - 1, cx + ri); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * w + x] = 1
}

/**
 * Une todas las islas de material al marco en una sola pasada: BFS por los
 * huecos desde el material principal; al tocar una isla se pinta el camino
 * (del grueso pedido) y la isla se suma como origen, así cada isla queda
 * unida por el puente más corto a lo que ya está unido.
 * Invariante: el píxel 0 es el marco de 1 px, siempre material principal.
 */
function puentesAIslas(material: Uint8Array, w: number, h: number, r: number): { puestos: number; quedan: number } {
  const N = w * h
  const { etiqueta, n } = componentes(material, w, h)
  if (n <= 1) return { puestos: 0, quedan: 0 }
  // Píxeles de cada etiqueta, contiguos (orden por conteo)
  const inicio = new Int32Array(n + 2)
  for (let i = 0; i < N; i++) inicio[etiqueta[i] + 1]++
  for (let e = 1; e <= n + 1; e++) inicio[e] += inicio[e - 1]
  const lugar = inicio.slice()
  const orden = new Int32Array(N)
  for (let i = 0; i < N; i++) orden[lugar[etiqueta[i]]++] = i

  const unida = new Uint8Array(n + 1)
  const previo = new Int32Array(N).fill(-1)
  const cola = new Int32Array(N)
  let ini = 0
  let fin = 0
  const sembrar = (e: number) => {
    unida[e] = 1
    for (let k = inicio[e]; k < inicio[e + 1]; k++) {
      const p = orden[k]
      previo[p] = p
      cola[fin++] = p
    }
  }
  sembrar(etiqueta[0])
  let puestos = 0
  const visitar = (p: number, q: number) => {
    if (previo[q] >= 0) return
    const e = etiqueta[q]
    if (!e) {
      previo[q] = p
      cola[fin++] = q
    } else if (!unida[e]) {
      for (let s = p; previo[s] !== s; s = previo[s]) disco(material, w, h, s % w, (s - (s % w)) / w, r)
      puestos++
      sembrar(e)
    }
  }
  while (ini < fin) {
    const p = cola[ini++]
    const x = p % w
    if (x > 0) visitar(p, p - 1)
    if (x < w - 1) visitar(p, p + 1)
    if (p >= w) visitar(p, p - w)
    if (p < N - w) visitar(p, p + w)
  }
  return { puestos, quedan: n - 1 - puestos }
}

// ── El panel ───────────────────────────────────────────────────────────────

export const LADO_MAX = 900 // px del lado largo del área calada (detalle vs. rapidez)

/** Número finito dentro de [min, max]; si no es número, el valor por omisión. */
const acotar = (x: number, min: number, max: number, omision: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : omision)

export const MEDIDA_MAX = 6000 // mm: una lámina grande; más ya no es una pieza

/** Gris suavizado de la imagen: sólo cambia con la imagen, se puede guardar entre cálculos. */
export const grisSuave = (im: Imagen) => desenfocar(gris(im), im.width, im.height)

export function hacerCelosiaImagen(im: Imagen, opciones: OpcionesCelosiaImagen, g: Uint8Array = grisSuave(im)) {
  const avisos: string[] = []
  const o = {
    ...opciones,
    puenteMin: acotar(opciones.puenteMin, 0.2, 200, 3),
    huecoMin: acotar(opciones.huecoMin, 0.2, 200, 3),
    diametroBarreno: acotar(opciones.diametroBarreno, 1, 100, 8),
  }
  const W = acotar(o.ancho, 20, MEDIDA_MAX, 600)
  const H = acotar(o.alto, 20, MEDIDA_MAX, 600)
  const m = Math.max(0, Math.min(acotar(o.marco, 0, MEDIDA_MAX, 0), W / 2 - 5, H / 2 - 5))
  if (!esquinasValidas(o.esquinas)) {
    avisos.push("Las 4 esquinas se cruzan o están casi en línea: acomódalas en orden (arriba izquierda, arriba derecha, abajo derecha, abajo izquierda) sobre las esquinas del diseño.")
    return { dibujo: dibujo([rect(0, 0, W, H)], avisos), huecos: 0, avisos, umbral: 0, mmpx: 0 }
  }
  const aw = W - 2 * m
  const ah = H - 2 * m
  // Resolución: mm por píxel
  const mmpx = Math.max(aw, ah) / LADO_MAX
  const w = Math.max(8, Math.round(aw / mmpx))
  const h = Math.max(8, Math.round(ah / mmpx))
  if (Math.min(aw, ah) / mmpx < 40) avisos.push("El panel es muy angosto para su largo: el detalle del lado corto se pierde. Haz el panel más proporcionado o córtalo en partes.")
  // Un píxel de marco alrededor, para que el material de la orilla sea el principal
  const W2 = w + 2
  const H2 = h + 2

  const rep = o.repetir
    ? { c: Math.round(acotar(o.repetir.columnas, 1, 60, 1)), f: Math.round(acotar(o.repetir.filas, 1, 60, 1)), espejo: o.repetir.espejo }
    : null
  let enderezada: Uint8Array
  if (rep && (rep.c > 1 || rep.f > 1)) {
    // Un módulo enderezado y se copia en mosaico sobre toda el área calada
    const mw = Math.max(4, Math.round(w / rep.c))
    const mh = Math.max(4, Math.round(h / rep.f))
    const modulo = enderezar(g, im.width, im.height, o.esquinas, mw, mh)
    enderezada = new Uint8Array(w * h)
    // Píxel t de n (en el panel) → píxel del módulo de m, con cuantos módulos
    const indice = (t: number, n: number, m: number, cuantos: number) => {
      const s = ((t + 0.5) / n) * cuantos
      const k = Math.min(Math.floor(s), cuantos - 1)
      let f = s - k
      if (rep.espejo && k % 2 === 1) f = 1 - f
      return Math.min(m - 1, Math.max(0, Math.floor(f * m)))
    }
    const colX = Int32Array.from({ length: w }, (_, x) => indice(x, w, mw, rep.c))
    for (let y = 0; y < h; y++) {
      const fila = indice(y, h, mh, rep.f) * mw
      for (let x = 0; x < w; x++) enderezada[y * w + x] = modulo[fila + colX[x]]
    }
    if (mw < 40 || mh < 40) avisos.push("Cada módulo queda muy chico para el detalle de la imagen: usa menos columnas o filas, o un panel más grande.")
  } else enderezada = enderezar(g, im.width, im.height, o.esquinas, w, h)
  const umbral = o.umbral ?? umbralAutomatico(enderezada)

  // material = 1 donde NO se corta
  let material = new Uint8Array(W2 * H2).fill(1)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const oscuro = enderezada[y * w + x] < umbral
      const corta = o.cortar === "oscuro" ? oscuro : !oscuro
      material[(y + 1) * W2 + (x + 1)] = corta ? 0 : 1
    }
  // 0. Fondo: las zonas a cortar que tocan la orilla de la foto enderezada son
  //    la pared o la mesa que quedó dentro de las 4 esquinas, no parte del diseño
  let fondo = 0
  if (o.fondo && !rep) {
    const cola: number[] = []
    const marcar = (x: number, y: number) => {
      const i = y * W2 + x
      if (!material[i]) { material[i] = 1; fondo++; cola.push(i) }
    }
    for (let x = 1; x <= w; x++) { marcar(x, 1); marcar(x, h) }
    for (let y = 1; y <= h; y++) { marcar(1, y); marcar(w, y) }
    while (cola.length) {
      const i = cola.pop()!
      const x = i % W2
      const y = (i - x) / W2
      if (x > 1) marcar(x - 1, y)
      if (x < w) marcar(x + 1, y)
      if (y > 1) marcar(x, y - 1)
      if (y < h) marcar(x, y + 1)
    }
  }
  const huecosAntes = material.reduce((a, x) => a + (x ? 0 : 1), 0)

  // 1. Huecos más angostos que el mínimo (o esquinas que no se alcanzan)
  const rh = o.huecoMin / 2 / mmpx
  const huecos = abrir(negar(material), W2, H2, rh)
  material = negar(huecos)
  const quitados = huecosAntes - huecos.reduce((a, x) => a + x, 0)
  const motivo = { plasma: "el plasma no los corta limpio", router: "la fresa no entra ahí", laser: "salen quemados" }[o.proceso]

  // 2. Puentes más delgados que el mínimo: se engruesan sólo donde son delgados
  const rp = o.puenteMin / 2 / mmpx
  const grueso = abrir(material, W2, H2, rp)
  let delgados = 0
  const delgado = new Uint8Array(W2 * H2)
  for (let i = 0; i < W2 * H2; i++) if (material[i] && !grueso[i]) { delgado[i] = 1; delgados++ }
  if (delgados) {
    const extra = dilatar(delgado, W2, H2, rp)
    for (let i = 0; i < W2 * H2; i++) if (extra[i]) material[i] = 1
    // Al engrosar quedan muescas y rendijas: los huecos se vuelven a redondear
    // con el mismo radio mínimo, así la orilla queda lisa y cortable
    material = negar(abrir(negar(material), W2, H2, Math.max(rh, rp / 2)))
  }

  // 3. Islas
  let puestos = 0
  let quitadas = 0
  let sueltas = 0
  const { etiqueta, n } = componentes(material, W2, H2)
  if (n > 1) {
    if (o.islas === "puentes") {
      const r = puentesAIslas(material, W2, H2, Math.max(rp, 0.5))
      puestos = r.puestos
      sueltas = r.quedan
    } else if (o.islas === "quitar") {
      const principal = etiqueta[0]
      for (let i = 0; i < W2 * H2; i++) if (etiqueta[i] && etiqueta[i] !== principal) material[i] = 0
      quitadas = n - 1
    } else sueltas = n - 1
  }

  // 4. Contornos de los huecos → mm (Y hacia arriba)
  const curvas = curvasDeMascara(negar(material), W2, H2, { tolerancia: 0.6, manchas: 4, suave: true })
  const huecosTrazos = curvasATrazos(curvas).map((t) => ({
    ...t,
    pts: t.pts.map(([x, y]) => [m + (x - 1) * mmpx, H - (m + (y - 1) * mmpx)] as P),
  }))

  const trazos: Trazo[] = [rect(0, 0, W, H), ...huecosTrazos]
  if (o.barrenos && m >= o.diametroBarreno + 2) {
    const d = m / 2
    for (const [x, y] of [[d, d], [W - d, d], [W - d, H - d], [d, H - d]] as P[]) trazos.push(circulo(x, y, o.diametroBarreno / 2))
  } else if (o.barrenos) avisos.push("El marco es muy angosto para los barrenos: hazlo más ancho que el barreno más 2 mm.")

  const cm2 = (px: number) => Math.round((px * mmpx * mmpx) / 10) / 10 // px → cm² con 1 decimal
  if (quitados > 0) avisos.push(`Se quitaron huecos o puntas más angostos que ${o.huecoMin} mm (unos ${cm2(quitados)} cm²): ${motivo}.`)
  if (delgados > 0) avisos.push(`Se engruesaron puentes más delgados que ${o.puenteMin} mm para que no se quemen ni se doblen.`)
  if (puestos) avisos.push(`${puestos} pieza(s) quedaban sueltas: se les puso un puente de ${o.puenteMin} mm al resto del panel.`)
  if (quitadas) avisos.push(`Se quitaron ${quitadas} pieza(s) que quedaban sueltas.`)
  if (sueltas) avisos.push(`${sueltas} pieza(s) quedan sueltas: al cortar se caen. Elige "Ponerles puente" si deben quedarse.`)
  if (fondo > w * h * 0.04) avisos.push(`Se dejó sin cortar el fondo que toca la orilla de la foto (unos ${cm2(fondo)} cm²). Si tu diseño sí llega hasta el marco, apaga «Ignorar el fondo».`)
  if (!huecosTrazos.length) avisos.push("No quedó ningún hueco: prueba cortar lo claro en vez de lo oscuro, mueve el umbral o baja el hueco mínimo.")
  if (m < 10) avisos.push("Un marco de menos de 10 mm deja el panel frágil en la orilla.")

  return { dibujo: dibujo(trazos, avisos), huecos: huecosTrazos.length, avisos, umbral, mmpx }
}

export type ResultadoCelosiaImagen = ReturnType<typeof hacerCelosiaImagen>
