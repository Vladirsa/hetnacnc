// Molduras y tallados para router CNC.
//
// - Moldura recta: un perfil (media caña, bocel, ogee, chaflán…) a lo largo de
//   un largo. Sale como sólido STL (para el Laboratorio CAM: desbaste y acabado
//   con fresa de bola) y como DXF del perfil (para mandar a hacer una fresa de
//   perfil o para el CAM 2D).
// - Panel: marco con la moldura alrededor (esquinas a inglete, que salen solas
//   del campo de distancia a la orilla) y el centro liso o tallado en relieve
//   con un patrón o una imagen. Sale como STL (mapa de alturas) y como DXF con
//   el contorno de corte y las líneas para tallar en V (grabado 2D).
//
// Todo en mm. Sin DOM: corre en el navegador o en el servidor.

import type { Trazo } from "./geo2d"
import { type Alturas, type OpcionesRelieve, mallaSTL } from "./relieve"

type P = [number, number]

export type TipoPerfil = "chaflan" | "media-cana" | "bocel" | "medio-bocel" | "ogee" | "romana" | "escalonada" | "clasica"
// h(t): altura del perfil (0 a 1) a una fracción t del ancho, de la orilla de afuera (t = 0) hacia adentro (t = 1)
export const PERFILES: { id: TipoPerfil; nombre: string; h: (t: number) => number; concavo: number }[] = [
  { id: "chaflan", nombre: "Chaflán", h: (t) => t, concavo: Infinity },
  { id: "media-cana", nombre: "Media caña", h: (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t)), concavo: 1 },
  { id: "bocel", nombre: "Cuarto bocel", h: (t) => Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))), concavo: Infinity },
  { id: "medio-bocel", nombre: "Medio bocel", h: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1))), concavo: Infinity },
  { id: "ogee", nombre: "Gola (ogee)", h: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t), concavo: 0.5 },
  { id: "romana", nombre: "Romana", h: (t) => (t < 0.5 ? 0.5 * (1 - Math.sqrt(Math.max(0, 1 - 4 * t * t))) : 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - (2 - 2 * t) * (2 - 2 * t)))), concavo: 0.5 },
  { id: "escalonada", nombre: "Escalonada", h: (t) => Math.min(1, Math.floor(t * 3 + 1e-9) / 3 + Math.max(0, (t * 3) % 1 - 0.8) * (5 / 3)), concavo: 0 },
  {
    id: "clasica",
    nombre: "Clásica (bocel + media caña)",
    h: (t) => (t < 0.3 ? 0.45 * Math.sqrt(Math.max(0, 1 - ((t - 0.15) / 0.15) ** 2)) + 0.25 : t < 0.4 ? 0.25 : 0.25 + 0.75 * (1 - Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2)))),
    concavo: 0.6,
  },
]
export const perfilDe = (id: TipoPerfil) => PERFILES.find((p) => p.id === id) || PERFILES[0]

// radio cóncavo más chico del perfil en mm (para saber si la fresa de bola cabe)
export function radioConcavoMinimo(perfil: TipoPerfil, ancho: number, alto: number): number {
  const h = perfilDe(perfil).h
  let min = Infinity
  const n = 400
  for (let i = 2; i < n - 1; i++) {
    const t0 = (i - 1) / n, t1 = i / n, t2 = (i + 1) / n
    const x0 = t0 * ancho, x1 = t1 * ancho, x2 = t2 * ancho
    const z0 = h(t0) * alto, z1 = h(t1) * alto, z2 = h(t2) * alto
    const d1 = (z2 - z0) / (x2 - x0)
    const d2 = (z2 - 2 * z1 + z0) / ((x1 - x0) * (x2 - x1))
    if (d2 > 1e-6) min = Math.min(min, Math.pow(1 + d1 * d1, 1.5) / d2) // cóncavo (hacia arriba)
  }
  return min
}

// ---------- moldura recta ----------
export type OpcionesMoldura = { perfil: TipoPerfil; ancho: number; alto: number; base: number; largo: number; invertir: boolean }

// sección: puntos (x, z) del contorno cerrado, de la orilla de afuera a la de adentro
export function seccionMoldura(o: OpcionesMoldura, n = 120): P[] {
  const h = perfilDe(o.perfil).h
  const top: P[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ht = o.invertir ? h(1 - t) : h(t)
    top.push([t * o.ancho, o.base + o.alto * ht])
  }
  return [[0, 0], [o.ancho, 0], ...top.reverse()]
}

// sólido de la moldura: la sección extruida a lo largo (Y), en STL binario
export function mallaMoldura(o: OpcionesMoldura): ArrayBuffer {
  const s = seccionMoldura(o)
  const L = o.largo
  const tris: number[][] = []
  // tapas (triangulación en abanico desde el centro de la base: la sección es estrellada desde ahí)
  const c: P = [o.ancho / 2, 0]
  for (let i = 0; i < s.length; i++) {
    const a = s[i], b = s[(i + 1) % s.length]
    if ((a[0] === c[0] && a[1] === c[1]) || (b[0] === c[0] && b[1] === c[1])) continue
    tris.push([c[0], 0, c[1], b[0], 0, b[1], a[0], 0, a[1]])
    tris.push([c[0], L, c[1], a[0], L, a[1], b[0], L, b[1]])
  }
  // costados
  for (let i = 0; i < s.length; i++) {
    const a = s[i], b = s[(i + 1) % s.length]
    tris.push([a[0], 0, a[1], b[0], 0, b[1], b[0], L, b[1]])
    tris.push([a[0], 0, a[1], b[0], L, b[1], a[0], L, a[1]])
  }
  return stlDe(tris)
}

// ---------- panel con marco y centro tallado ----------
export type Patron = "liso" | "roseton" | "rombos" | "ondas" | "estrella" | "imagen"
export const PATRONES: { id: Patron; nombre: string }[] = [
  { id: "liso", nombre: "Liso" },
  { id: "roseton", nombre: "Rosetón" },
  { id: "estrella", nombre: "Estrella" },
  { id: "rombos", nombre: "Rombos" },
  { id: "ondas", nombre: "Ondas" },
  { id: "imagen", nombre: "Desde una imagen" },
]
export type OpcionesPanel = {
  ancho: number
  alto: number
  grosor: number // tablero
  perfil: TipoPerfil
  anchoMoldura: number
  hondoMoldura: number // cuánto baja la moldura desde la cara del tablero
  patron: Patron
  hondoTallado: number // relieve del centro
  petalos: number // rosetón y estrella
  imagen?: { gris: Float32Array; w: number; h: number } // 0–255, ya reducida
  paso: number // mm entre puntos del mapa de alturas
}

// valor del patrón (0 a 1) en el punto (u, v) del centro, con u, v en [0, 1]
function patron(o: OpcionesPanel, u: number, v: number): number {
  const x = u * 2 - 1, y = v * 2 - 1
  const r = Math.hypot(x, y), th = Math.atan2(y, x)
  const n = Math.max(3, Math.min(24, Math.round(o.petalos)))
  switch (o.patron) {
    case "roseton": {
      const borde = 0.92 * (0.62 + 0.38 * Math.abs(Math.cos((n * th) / 2)))
      if (r > borde) return 0
      const petalo = Math.pow(Math.abs(Math.cos((n * th) / 2)), 0.6)
      const centro = Math.max(0, 1 - r / 0.22)
      return Math.min(1, Math.max(centro, petalo * Math.sin((Math.PI * r) / borde) * 0.95))
    }
    case "estrella": {
      const borde = 0.9 * (0.45 + 0.55 * Math.pow(Math.abs(Math.cos((n * th) / 2)), 3))
      return r > borde ? 0 : 1 - r / borde
    }
    case "rombos": {
      const k = 4
      const a = Math.abs(((u * k) % 1) - 0.5) + Math.abs(((v * k) % 1) - 0.5)
      return Math.max(0, 1 - a * 2)
    }
    case "ondas":
      return 0.5 + 0.5 * Math.sin(u * Math.PI * 6) * Math.cos(v * Math.PI * 4)
    case "imagen": {
      const im = o.imagen
      if (!im) return 0
      const px = Math.min(im.w - 1, Math.max(0, Math.round(u * (im.w - 1))))
      const py = Math.min(im.h - 1, Math.max(0, Math.round((1 - v) * (im.h - 1))))
      return im.gris[py * im.w + px] / 255
    }
    default:
      return 0
  }
}

// mapa de alturas del panel (Z = 0 abajo, la cara del tablero en Z = grosor)
export function alturasPanel(o: OpcionesPanel): Alturas {
  const paso = Math.max(0.3, o.paso)
  const nx = Math.max(2, Math.round(o.ancho / paso) + 1)
  const ny = Math.max(2, Math.round(o.alto / paso) + 1)
  const z = new Float32Array(nx * ny)
  const h = perfilDe(o.perfil).h
  const A = Math.max(1, o.anchoMoldura)
  const tope = o.grosor
  const fondoMoldura = tope - o.hondoMoldura // donde termina la moldura (el campo del centro)
  const c0 = A, cW = Math.max(1, o.ancho - 2 * A), cH = Math.max(1, o.alto - 2 * A)
  for (let j = 0; j < ny; j++) {
    // colocador de relieve.ts: Y del dibujo va hacia abajo (j = 0 arriba)
    const yy = o.alto - j * paso
    for (let i = 0; i < nx; i++) {
      const xx = i * paso
      const d = Math.min(xx, o.ancho - xx, yy, o.alto - yy)
      let val: number
      if (d < A) {
        // la moldura baja desde la orilla (arriba) hacia el campo (abajo)
        val = tope - o.hondoMoldura * h(d / A)
      } else {
        const u = (xx - c0) / cW, v = (yy - c0) / cH
        val = fondoMoldura + o.hondoTallado * patron(o, u, v)
      }
      z[j * nx + i] = Math.max(0.5, Math.min(tope, val))
    }
  }
  return { z, nx, ny }
}

export function mallaPanel(o: OpcionesPanel): ArrayBuffer {
  const op = { modo: "relieve", forma: "plano", arco: 0, paso: Math.max(0.3, o.paso), min: 0, max: o.grosor, marco: 0, invertir: false, gamma: 1, suavizado: 0 } as OpcionesRelieve
  return mallaSTL(alturasPanel(o), op)
}

// ---------- 2D: contorno de corte, límite de la moldura y líneas para tallar en V ----------
export function dibujoPanel(o: OpcionesPanel): Trazo[] {
  const t: Trazo[] = []
  const A = o.anchoMoldura
  t.push({ pts: [[0, 0], [o.ancho, 0], [o.ancho, o.alto], [0, o.alto]], cerrado: true, capa: "corte" })
  t.push({ pts: [[A, A], [o.ancho - A, A], [o.ancho - A, o.alto - A], [A, o.alto - A]], cerrado: true, capa: "guia" })
  const cx = o.ancho / 2, cy = o.alto / 2
  const R = Math.min(o.ancho, o.alto) / 2 - A - 10
  const n = Math.max(3, Math.min(24, Math.round(o.petalos)))
  if (R > 10 && (o.patron === "roseton" || o.patron === "estrella")) {
    const pts: P[] = []
    for (let k = 0; k <= 360; k++) {
      const th = (k / 360) * Math.PI * 2
      const r = o.patron === "roseton" ? R * 0.92 * (0.62 + 0.38 * Math.abs(Math.cos((n * th) / 2))) : R * 0.9 * (0.45 + 0.55 * Math.pow(Math.abs(Math.cos((n * th) / 2)), 3))
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)])
    }
    t.push({ pts, cerrado: true, capa: "grabado" })
    // nervaduras de los pétalos
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2
      t.push({ pts: [[cx + Math.cos(th) * R * 0.22, cy + Math.sin(th) * R * 0.22], [cx + Math.cos(th) * R * 0.85, cy + Math.sin(th) * R * 0.85]], cerrado: false, capa: "grabado" })
    }
  }
  if (o.patron === "rombos") {
    const k = 4
    const w = (o.ancho - 2 * A) / k, h = (o.alto - 2 * A) / k
    for (let i = 0; i < k; i++)
      for (let j = 0; j < k; j++) {
        const x = A + i * w, y = A + j * h
        t.push({ pts: [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], cerrado: true, capa: "grabado" })
      }
  }
  return t
}

// perfil de la moldura como dibujo 2D (para mandar a hacer la fresa o revisar la sección)
export function dibujoSeccion(o: OpcionesMoldura): Trazo[] {
  return [{ pts: seccionMoldura(o), cerrado: true, capa: "corte" }]
}

// ---------- STL ----------
function stlDe(tris: number[][]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + 50 * tris.length)
  const dv = new DataView(buf)
  const cab = "HETNA CNC - moldura"
  for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i))
  dv.setUint32(80, tris.length, true)
  let o = 84
  for (const t of tris) {
    const ax = t[0], ay = t[1], az = t[2]
    const bx = t[3] - ax, by = t[4] - ay, bz = t[5] - az, cx = t[6] - ax, cy = t[7] - ay, cz = t[8] - az
    let nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true)
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, t[k], true)
    dv.setUint16(o + 48, 0, true)
    o += 50
  }
  return buf
}

// STL binario → triángulos (9 números cada uno) para el visor 3D
export function trisDeSTL(buf: ArrayBuffer): number[] {
  const dv = new DataView(buf)
  const n = dv.getUint32(80, true)
  const out = new Array<number>(n * 9)
  for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(84 + i * 50 + 12 + k * 4, true)
  return out
}
