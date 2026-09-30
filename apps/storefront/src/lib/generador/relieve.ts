// Litofanías y relieves 3D a partir de una foto: la foto se vuelve un mapa de alturas y de ahí
// una malla cerrada (STL) lista para imprimir o para el CAM del router. Todo corre en el navegador.

export type Forma = "plano" | "curvo" | "cilindro"
export type OpcionesRelieve = {
  modo: "litofania" | "relieve"
  forma: Forma
  arco: number // grados, solo curvo
  paso: number // mm entre puntos de la malla
  min: number // mm, espesor más delgado (litofanía) o base (relieve)
  max: number // mm, espesor más grueso
  marco: number // mm de marco alrededor (0 = sin marco)
  invertir: boolean // litofanía: normal = oscuro grueso; relieve: normal = claro alto
  gamma: number // 0.3 a 3
  suavizado: number // píxeles de suavizado (0 = nada)
}

export type Alturas = { z: Float32Array; nx: number; ny: number }

function desenfocar(g: Float32Array, w: number, h: number, r: number): Float32Array {
  const t = new Float32Array(g.length)
  const s = new Float32Array(g.length)
  for (let y = 0; y < h; y++) {
    let suma = 0
    const f = y * w
    for (let x = -r; x <= r; x++) suma += g[f + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      t[f + x] = suma / (2 * r + 1)
      suma += g[f + Math.min(w - 1, x + r + 1)] - g[f + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let suma = 0
    for (let y = -r; y <= r; y++) suma += t[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      s[y * w + x] = suma / (2 * r + 1)
      suma += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]
    }
  }
  return s
}

// gris 0–255 de la foto ya reducida a w × h puntos -> alturas en mm con el marco incluido
export function alturas(gris: Float32Array, w: number, h: number, o: OpcionesRelieve): Alturas {
  const g = o.suavizado > 0 ? desenfocar(gris, w, h, Math.round(o.suavizado)) : gris
  const oscuroArriba = o.modo === "litofania" ? !o.invertir : o.invertir
  const m = Math.max(0, Math.round(o.marco / o.paso))
  const mx = o.forma === "cilindro" ? 0 : m // el cilindro se cierra sobre sí mismo: sin marco a los lados
  const nx = w + 2 * mx
  const ny = h + 2 * m
  const z = new Float32Array(nx * ny).fill(o.max)
  const g2 = Math.max(0.1, o.gamma)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const L = Math.max(0, Math.min(1, g[y * w + x] / 255))
      const v = Math.pow(oscuroArriba ? 1 - L : L, g2)
      z[(y + m) * nx + x + mx] = o.min + v * (o.max - o.min)
    }
  }
  return { z, nx, ny }
}

// Posición 3D de un punto de la malla (x, y en mm; y hacia arriba), a una distancia d de la cara de atrás
function colocador(a: Alturas, o: OpcionesRelieve) {
  const { nx, ny } = a
  const p = o.paso
  const alto = (ny - 1) * p
  if (o.forma === "plano") return (i: number, j: number, d: number): [number, number, number] => [i * p, alto - j * p, d]
  const cierre = o.forma === "cilindro"
  const theta = cierre ? 2 * Math.PI : (Math.max(10, Math.min(340, o.arco)) * Math.PI) / 180
  const L = cierre ? nx * p : (nx - 1) * p // largo desarrollado
  const R = L / theta
  return (i: number, j: number, d: number): [number, number, number] => {
    const phi = cierre ? (i / nx) * theta : (i / (nx - 1) - 0.5) * theta
    return [(R + d) * Math.sin(phi), alto - j * p, (R + d) * Math.cos(phi) - R]
  }
}

// Malla cerrada en STL binario (unidades en mm)
export function mallaSTL(a: Alturas, o: OpcionesRelieve): ArrayBuffer {
  const { z, nx, ny } = a
  const cierre = o.forma === "cilindro"
  const pos = colocador(a, o)
  const n = nx * ny
  const V = new Float32Array(n * 2 * 3)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      V.set(pos(i, j, z[k]), k * 3)
      V.set(pos(i, j, 0), (n + k) * 3)
    }
  }
  const T = (i: number, j: number) => j * nx + (i % nx)
  const B = (i: number, j: number) => n + j * nx + (i % nx)
  const columnas = cierre ? nx : nx - 1
  const total = 4 * columnas * (ny - 1) + 4 * columnas + (cierre ? 0 : 4 * (ny - 1))
  const buf = new ArrayBuffer(84 + 50 * total)
  const dv = new DataView(buf)
  const cab = "HETNA CNC - relieve"
  for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i))
  dv.setUint32(80, total, true)
  let o2 = 84
  const tri = (a1: number, b1: number, c1: number) => {
    const ax = V[a1 * 3], ay = V[a1 * 3 + 1], az = V[a1 * 3 + 2]
    const bx = V[b1 * 3] - ax, by = V[b1 * 3 + 1] - ay, bz = V[b1 * 3 + 2] - az
    const cx = V[c1 * 3] - ax, cy = V[c1 * 3 + 1] - ay, cz = V[c1 * 3 + 2] - az
    let nx1 = by * cz - bz * cy, ny1 = bz * cx - bx * cz, nz1 = bx * cy - by * cx
    const l = Math.hypot(nx1, ny1, nz1) || 1
    nx1 /= l; ny1 /= l; nz1 /= l
    dv.setFloat32(o2, nx1, true); dv.setFloat32(o2 + 4, ny1, true); dv.setFloat32(o2 + 8, nz1, true)
    let q = o2 + 12
    for (const v of [a1, b1, c1]) {
      dv.setFloat32(q, V[v * 3], true); dv.setFloat32(q + 4, V[v * 3 + 1], true); dv.setFloat32(q + 8, V[v * 3 + 2], true)
      q += 12
    }
    dv.setUint16(o2 + 48, 0, true)
    o2 += 50
  }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < columnas; i++) {
      // cara con el dibujo
      tri(T(i, j), T(i, j + 1), T(i + 1, j))
      tri(T(i + 1, j), T(i, j + 1), T(i + 1, j + 1))
      // cara de atrás
      tri(B(i, j), B(i + 1, j), B(i, j + 1))
      tri(B(i + 1, j), B(i + 1, j + 1), B(i, j + 1))
    }
  }
  const J = ny - 1
  for (let i = 0; i < columnas; i++) {
    // orilla de arriba y de abajo
    tri(T(i, 0), T(i + 1, 0), B(i, 0))
    tri(T(i + 1, 0), B(i + 1, 0), B(i, 0))
    tri(T(i, J), B(i, J), T(i + 1, J))
    tri(T(i + 1, J), B(i, J), B(i + 1, J))
  }
  if (!cierre) {
    const I = nx - 1
    for (let j = 0; j < ny - 1; j++) {
      // orillas de los lados
      tri(T(0, j), B(0, j), T(0, j + 1))
      tri(T(0, j + 1), B(0, j), B(0, j + 1))
      tri(T(I, j), T(I, j + 1), B(I, j))
      tri(T(I, j + 1), B(I, j + 1), B(I, j))
    }
  }
  return buf
}

// Volumen aproximado en mm³ (para estimar material)
export function volumen(a: Alturas, o: OpcionesRelieve): number {
  let s = 0
  for (let i = 0; i < a.z.length; i++) s += a.z[i]
  return s * o.paso * o.paso
}

// Medidas de la pieza terminada en mm
export function medidasPieza(a: Alturas, o: OpcionesRelieve) {
  const alto = (a.ny - 1) * o.paso
  if (o.forma === "plano") return { ancho: (a.nx - 1) * o.paso, alto, fondo: o.max }
  const cierre = o.forma === "cilindro"
  const theta = cierre ? 2 * Math.PI : (Math.max(10, Math.min(340, o.arco)) * Math.PI) / 180
  const R = (cierre ? a.nx * o.paso : (a.nx - 1) * o.paso) / theta
  if (cierre) return { ancho: 2 * (R + o.max), alto, fondo: 2 * (R + o.max) }
  const ancho = theta >= Math.PI ? 2 * (R + o.max) : 2 * (R + o.max) * Math.sin(theta / 2)
  const fondo = R + o.max - R * Math.cos(Math.min(Math.PI, theta / 2))
  return { ancho, alto, fondo }
}

// Vista previa: cómo se ve la litofanía con luz por detrás (más grueso = más oscuro)
export function vistaLuz(a: Alturas, o: OpcionesRelieve): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.z.length * 4)
  const k = 1.4 // qué tanto oscurece cada mm de plástico
  const claro = Math.exp(-k * o.min)
  const oscuro = Math.exp(-k * o.max)
  for (let i = 0; i < a.z.length; i++) {
    const v = Math.max(0, Math.min(1, (Math.exp(-k * a.z[i]) - oscuro) / Math.max(1e-6, claro - oscuro)))
    out[i * 4] = 40 + 215 * v
    out[i * 4 + 1] = 28 + 200 * v
    out[i * 4 + 2] = 18 + 160 * v
    out[i * 4 + 3] = 255
  }
  return out
}

// Vista previa del relieve con luz rasante
export function vistaSombra(a: Alturas, o: OpcionesRelieve): Uint8ClampedArray {
  const { z, nx, ny } = a
  const out = new Uint8ClampedArray(z.length * 4)
  const l = [-0.5, 0.6, 0.62]
  const ll = Math.hypot(l[0], l[1], l[2])
  const exagera = 3
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const dzx = ((z[j * nx + Math.min(nx - 1, i + 1)] - z[j * nx + Math.max(0, i - 1)]) / (2 * o.paso)) * exagera
      const dzy = ((z[Math.max(0, j - 1) * nx + i] - z[Math.min(ny - 1, j + 1) * nx + i]) / (2 * o.paso)) * exagera
      const n = [-dzx, -dzy, 1]
      const nl = Math.hypot(n[0], n[1], n[2])
      const s = Math.max(0, (n[0] * l[0] + n[1] * l[1] + n[2] * l[2]) / (nl * ll))
      const v = 0.25 + 0.75 * s
      out[k * 4] = 222 * v
      out[k * 4 + 1] = 196 * v
      out[k * 4 + 2] = 160 * v
      out[k * 4 + 3] = 255
    }
  }
  return out
}

// Mapa de alturas en gris (blanco = lo más alto) para Aspire, VCarve o Carveco
export function mapaAlturas(a: Alturas, o: OpcionesRelieve): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.z.length * 4)
  const r = Math.max(1e-6, o.max - o.min)
  for (let i = 0; i < a.z.length; i++) {
    const v = Math.round((255 * (a.z[i] - o.min)) / r)
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v
    out[i * 4 + 3] = 255
  }
  return out
}
