// Catálogo de muebles prefabricados: cada uno sale de los generadores que ya
// existen (gabinete, cocina) o de una lista de tableros, y se abre en el editor
// para cambiarle medidas, material, uniones, piezas y componentes.

import { COCINA_INICIO, cocina, proponerModulos } from "./cocina"
import type { TableroC } from "./componentes"
import { GABINETE_INICIO, gabinete } from "./gabinete"
import type { TipoUnion } from "./tableros"

export type MuebleCatalogo = {
  id: string
  nombre: string
  categoria: "Recámara" | "Sala" | "Oficina" | "Cocina" | "Comedor" | "Organización"
  nota: string
  union: TipoUnion
  material: string
  varios?: boolean
  generar: (e: number) => TableroC[]
}

// caja abierta (costados, piso, techo, repisas y respaldo opcional), para libreros y exhibidores
function librero(e: number, ancho: number, alto: number, fondo: number, repisas: number, respaldo: boolean): TableroC[] {
  const t: TableroC[] = [
    { nombre: "Costado izquierdo", plano: "lateral", x0: 0, x1: e, y0: 0, y1: fondo, z0: 0, z1: alto },
    { nombre: "Costado derecho", plano: "lateral", x0: ancho - e, x1: ancho, y0: 0, y1: fondo, z0: 0, z1: alto },
    { nombre: "Piso", plano: "horizontal", x0: e, x1: ancho - e, y0: 0, y1: fondo, z0: 60, z1: 60 + e },
    { nombre: "Techo", plano: "horizontal", x0: e, x1: ancho - e, y0: 0, y1: fondo, z0: alto - e, z1: alto },
  ]
  const z0 = 60 + e, z1 = alto - e
  for (let i = 1; i <= repisas; i++) {
    const z = z0 + ((z1 - z0) * i) / (repisas + 1) - e / 2
    t.push({ nombre: `Repisa ${i}`, plano: "horizontal", x0: e, x1: ancho - e, y0: 0, y1: fondo, z0: z, z1: z + e })
  }
  if (respaldo) t.push({ nombre: "Fondo", plano: "frontal", rol: "fondo", material: "hdf", x0: 0, x1: ancho, y0: fondo, y1: fondo + 3, z0: 60, z1: alto })
  else t.push({ nombre: "Travesaño trasero", plano: "frontal", x0: e, x1: ancho - e, y0: fondo - e, y1: fondo, z0: alto - e - 120, z1: alto - e })
  return t
}

const conG = <T extends object>(o: T, e: number) => ({ ...o, grosor: e, gFrente: e })

export const CATALOGO: MuebleCatalogo[] = [
  {
    id: "librero",
    nombre: "Librero de 4 repisas",
    categoria: "Sala",
    nota: "800 × 1800 × 300",
    union: "espiga",
    material: "melamina-roble",
    generar: (e) => librero(e, 800, 1800, 300, 4, true),
  },
  {
    id: "exhibidor-bajo",
    nombre: "Repisa baja abierta",
    categoria: "Sala",
    nota: "1200 × 900 × 350",
    union: "espiga",
    material: "triplay-pino",
    generar: (e) => librero(e, 1200, 900, 350, 2, false),
  },
  {
    id: "centro-tv",
    nombre: "Centro de TV",
    categoria: "Sala",
    nota: "1200 × 500 × 420, 2 puertas",
    union: "minifix",
    material: "melamina-nogal",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.bajo, ancho: 1200, alto: 500, fondo: 420, zoclo: 60, techo: "completo", frente: "puertas", repisas: 1 }, e)).tableros,
  },
  {
    id: "buro",
    nombre: "Buró de 2 cajones",
    categoria: "Recámara",
    nota: "450 × 550 × 400",
    union: "minifix",
    material: "melamina-blanca",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.bajo, ancho: 450, alto: 550, fondo: 400, zoclo: 60, techo: "completo", frente: "cajones", cajones: 2 }, e)).tableros,
  },
  {
    id: "comoda",
    nombre: "Cómoda de 4 cajones",
    categoria: "Recámara",
    nota: "900 × 850 × 450",
    union: "minifix",
    material: "melamina-roble",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.bajo, ancho: 900, alto: 850, fondo: 450, zoclo: 80, techo: "completo", frente: "cajones", cajones: 4 }, e)).tableros,
  },
  {
    id: "ropero",
    nombre: "Ropero de 2 puertas",
    categoria: "Recámara",
    nota: "1000 × 2000 × 580",
    union: "minifix",
    material: "melamina-blanca",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.columna, ancho: 1000, alto: 2000, fondo: 580, zoclo: 80, frente: "puertas", repisas: 3 }, e)).tableros,
  },
  {
    id: "zapatera",
    nombre: "Zapatera",
    categoria: "Organización",
    nota: "700 × 1000 × 350",
    union: "confirmat",
    material: "melamina-gris",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.columna, ancho: 700, alto: 1000, fondo: 350, zoclo: 60, frente: "puertas", repisas: 4 }, e)).tableros,
  },
  {
    id: "escritorio",
    nombre: "Escritorio con pedestal",
    categoria: "Oficina",
    nota: "1200 × 600 × 750",
    union: "minifix",
    material: "melamina-blanca",
    generar: (e) => [
      { nombre: "Cubierta", plano: "horizontal", x0: 0, x1: 1200, y0: 0, y1: 600, z0: 750 - e, z1: 750 },
      { nombre: "Costado izquierdo", plano: "lateral", x0: 0, x1: e, y0: 0, y1: 600, z0: 0, z1: 750 - e },
      { nombre: "Costado del pedestal", plano: "lateral", x0: 800, x1: 800 + e, y0: 0, y1: 600, z0: 0, z1: 750 - e },
      { nombre: "Costado derecho", plano: "lateral", x0: 1200 - e, x1: 1200, y0: 0, y1: 600, z0: 0, z1: 750 - e },
      { nombre: "Piso del pedestal", plano: "horizontal", x0: 800 + e, x1: 1200 - e, y0: 0, y1: 600, z0: 60, z1: 60 + e },
      { nombre: "Repisa del pedestal", plano: "horizontal", x0: 800 + e, x1: 1200 - e, y0: 0, y1: 600, z0: 360, z1: 360 + e },
      { nombre: "Faldón trasero", plano: "frontal", x0: e, x1: 800, y0: 600 - e - 40, y1: 600 - 40, z0: 450, z1: 750 - e },
    ],
  },
  {
    id: "mesa",
    nombre: "Mesa de patas de tablero",
    categoria: "Comedor",
    nota: "1200 × 700 × 750",
    union: "espiga",
    material: "triplay-pino",
    generar: (e) => [
      { nombre: "Cubierta", plano: "horizontal", x0: 0, x1: 1200, y0: 0, y1: 700, z0: 750 - e, z1: 750 },
      { nombre: "Pata izquierda", plano: "lateral", x0: 80, x1: 80 + e, y0: 60, y1: 640, z0: 0, z1: 750 - e },
      { nombre: "Pata derecha", plano: "lateral", x0: 1120 - e, x1: 1120, y0: 60, y1: 640, z0: 0, z1: 750 - e },
      { nombre: "Travesaño", plano: "frontal", x0: 80 + e, x1: 1120 - e, y0: 350 - e / 2, y1: 350 + e / 2, z0: 550, z1: 750 - e },
    ],
  },
  {
    id: "banco",
    nombre: "Banco",
    categoria: "Comedor",
    nota: "900 × 320 × 450",
    union: "espiga",
    material: "triplay-pino",
    generar: (e) => [
      { nombre: "Asiento", plano: "horizontal", x0: 0, x1: 900, y0: 0, y1: 320, z0: 450 - e, z1: 450 },
      { nombre: "Lado izquierdo", plano: "lateral", x0: 80, x1: 80 + e, y0: 20, y1: 300, z0: 0, z1: 450 - e },
      { nombre: "Lado derecho", plano: "lateral", x0: 820 - e, x1: 820, y0: 20, y1: 300, z0: 0, z1: 450 - e },
      { nombre: "Faldón", plano: "frontal", x0: 80 + e, x1: 820 - e, y0: 160 - e / 2, y1: 160 + e / 2, z0: 250, z1: 380 },
    ],
  },
  {
    id: "alacena",
    nombre: "Alacena (columna)",
    categoria: "Cocina",
    nota: "600 × 2100 × 560",
    union: "confirmat",
    material: "melamina-blanca",
    generar: (e) => gabinete(conG({ ...GABINETE_INICIO.columna, ancho: 600, alto: 2100, fondo: 560, frente: "puertas", repisas: 4 }, e)).tableros,
  },
  {
    id: "cocina-24",
    nombre: "Cocina de 2.4 m",
    categoria: "Cocina",
    nota: "Bajos, altos y cubierta",
    union: "confirmat",
    material: "melamina-blanca",
    varios: true,
    generar: (e) => cocina({ ...COCINA_INICIO, modulos: proponerModulos(2400, false), grosor: e }).tableros,
  },
]

// ---------- miniatura isométrica (SVG) de una lista de tableros ----------
export function miniaturaSVG(ts: TableroC[], ancho = 120, alto = 96): string {
  if (!ts.length) return ""
  const P = (x: number, y: number, z: number): [number, number] => [x - y * 0.55, -(z + y * 0.32)]
  const pts = ts.flatMap((t) => [P(t.x0, t.y0, t.z0), P(t.x1, t.y1, t.z1), P(t.x0, t.y1, t.z1), P(t.x1, t.y0, t.z0), P(t.x1, t.y0, t.z1), P(t.x0, t.y1, t.z0)])
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]))
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]))
  const k = Math.min((ancho - 8) / (x1 - x0 || 1), (alto - 8) / (y1 - y0 || 1))
  const Q = (x: number, y: number, z: number) => {
    const [a, b] = P(x, y, z)
    return `${((a - x0) * k + 4).toFixed(1)},${((b - y0) * k + 4).toFixed(1)}`
  }
  // de atrás hacia adelante y de abajo hacia arriba
  const orden = [...ts].sort((a, b) => b.y0 + b.y1 - (a.y0 + a.y1) || a.z0 - b.z0)
  const color = (t: TableroC) => (t.rol === "puerta" || t.rol === "frente" ? ["#e7c99b", "#f1dcb8", "#d4b081"] : t.rol === "cubierta" ? ["#b98b5a", "#caa070", "#a67a4c"] : ["#d6b48a", "#e8cfa6", "#c49e6c"])
  const caras = orden
    .map((t) => {
      const [c1, c2, c3] = color(t)
      const frente = `${Q(t.x0, t.y0, t.z0)} ${Q(t.x1, t.y0, t.z0)} ${Q(t.x1, t.y0, t.z1)} ${Q(t.x0, t.y0, t.z1)}`
      const arriba = `${Q(t.x0, t.y0, t.z1)} ${Q(t.x1, t.y0, t.z1)} ${Q(t.x1, t.y1, t.z1)} ${Q(t.x0, t.y1, t.z1)}`
      const lado = `${Q(t.x1, t.y0, t.z0)} ${Q(t.x1, t.y1, t.z0)} ${Q(t.x1, t.y1, t.z1)} ${Q(t.x1, t.y0, t.z1)}`
      return `<polygon points="${frente}" fill="${c1}" stroke="#5a3a1a" stroke-width="0.5"/><polygon points="${arriba}" fill="${c2}" stroke="#5a3a1a" stroke-width="0.5"/><polygon points="${lado}" fill="${c3}" stroke="#5a3a1a" stroke-width="0.5"/>`
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${caras}</svg>`
}
