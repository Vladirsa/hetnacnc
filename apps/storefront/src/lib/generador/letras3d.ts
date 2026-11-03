// Letras 3D en caja para corte láser o router (anuncios, letras luminosas,
// decoración). Cada letra se arma por CAPAS apiladas del mismo material:
//
//   frente   ── la letra completa (MDF o acrílico para que pase la luz)
//   paredes  ── anillos: la letra menos su contorno hacia adentro
//   fondo    ── la letra completa, con barreno para el cable del LED
//
// Al pegar las capas queda una letra hueca del grosor que pidas, sin doblar
// madera ni pestañas: funciona con cualquier tipografía y cualquier máquina.
// Todo en milímetros, Y hacia arriba, calculado en el navegador.

import * as jscad from "@jscad/modeling"

import { type Fuente } from "@/lib/generador/letreros"
import type { Curva, Pt } from "@/lib/generador/trazado"
import type { Dibujo, Malla, P, Trazo } from "@/lib/generador/vectores"

import { ShapeUtils, Vector2 } from "three"

const { geom2 } = jscad.geometries
const { union, subtract } = jscad.booleans
const { offset } = jscad.expansions

export type Construccion = "mdf" | "mdf_acrilico" | "acrilico"

export const CONSTRUCCIONES: { id: Construccion; nombre: string; detalle: string }[] = [
  { id: "mdf", nombre: "Todo MDF", detalle: "Letra sólida de madera" },
  { id: "mdf_acrilico", nombre: "MDF + frente de acrílico", detalle: "La luz sale por el frente" },
  { id: "acrilico", nombre: "Todo acrílico", detalle: "Brilla toda la letra" },
]

export type OpcionesLetras3D = {
  texto: string
  alto: number // alto de la letra mayúscula (la H), mm
  espaciado: number // entre letras, mm
  profundidad: number // grosor total de la letra, mm
  espesor: number // espesor del material de paredes y fondo, mm
  espesorFrente: number // espesor del frente (acrílico suele ser 3 mm)
  pared: number // ancho de la pared de cada anillo, mm
  construccion: Construccion
  cable: number // diámetro del barreno para el cable en el fondo (0 = sin barreno)
}

export type PiezaLetra = {
  id: string
  letra: string
  rol: "frente" | "pared" | "fondo"
  material: "MDF" | "Acrílico"
  espesor: number
  cantidad: number
  contornos: P[][] // exteriores y huecos, en mm, con la letra en su lugar
  z: number // altura de la primera capa (para la vista 3D)
}

export type ResultadoLetras3D = {
  piezas: PiezaLetra[]
  ancho: number
  alto: number
  capasPared: number
  profundidadReal: number
  avisos: string[]
  errores: string[]
}

// ---------------------------------------------------------------------
// Texto → contornos por letra
// ---------------------------------------------------------------------

type Cmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }

function aplanarComandos(cmds: Cmd[], paso = 0.6): P[][] {
  const lazos: P[][] = []
  let actual: P[] = []
  let a: Pt = [0, 0]
  const cerrar = () => {
    if (actual.length >= 3) {
      const q = actual[actual.length - 1]
      if (Math.hypot(q[0] - actual[0][0], q[1] - actual[0][1]) < 1e-4) actual.pop()
      if (actual.length >= 3) lazos.push(actual)
    }
    actual = []
  }
  for (const c of cmds) {
    if (c.type === "M") {
      cerrar()
      a = [c.x!, c.y!]
      actual.push([a[0], -a[1]])
    } else if (c.type === "L") {
      a = [c.x!, c.y!]
      actual.push([a[0], -a[1]])
    } else if (c.type === "Q" || c.type === "C") {
      const c1: Pt = [c.x1!, c.y1!]
      const c2: Pt = c.type === "C" ? [c.x2!, c.y2!] : c1
      const p: Pt = [c.x!, c.y!]
      const L = Math.hypot(c1[0] - a[0], c1[1] - a[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p[0] - c2[0], p[1] - c2[1])
      const n = Math.max(2, Math.min(40, Math.ceil(L / paso)))
      for (let i = 1; i <= n; i++) {
        const s = i / n
        const u = 1 - s
        let x: number, y: number
        if (c.type === "Q") {
          x = u * u * a[0] + 2 * u * s * c1[0] + s * s * p[0]
          y = u * u * a[1] + 2 * u * s * c1[1] + s * s * p[1]
        } else {
          x = u * u * u * a[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * p[0]
          y = u * u * u * a[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * p[1]
        }
        actual.push([x, -y])
      }
      a = p
    } else if (c.type === "Z") {
      cerrar()
    }
  }
  cerrar()
  return lazos
}

const area = (p: P[]) => {
  let s = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1])
  return s / 2
}

function dentro(pt: P, poly: P[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Quita puntos repetidos o casi iguales (las curvas de la tipografía y los
// cortes booleanos dejan puntos a micras uno del otro, y jscad los toma como
// contornos abiertos) y redondea a 0.1 µm para que coincidan exactamente.
const REJILLA = 1e-4
function limpiarLazo(l: P[]): P[] {
  const out: P[] = []
  for (const [x0, y0] of l) {
    const x = Math.round(x0 / REJILLA) * REJILLA
    const y = Math.round(y0 / REJILLA) * REJILLA
    const u = out[out.length - 1]
    if (u && Math.hypot(u[0] - x, u[1] - y) < 1e-3) continue
    out.push([x, y])
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-3) out.pop()
  return out
}

// lazos sueltos (en cualquier sentido) → figura jscad con sus huecos
function aFigura(lazos: P[][]) {
  const validos = lazos.map(limpiarLazo).filter((l) => l.length >= 3 && Math.abs(area(l)) > 0.05)
  const prof = validos.map((l, i) => validos.filter((o, j) => j !== i && dentro(l[0], o)).length)
  const ccw = (l: P[]) => (area(l) > 0 ? l : [...l].reverse())
  const exteriores = validos.filter((_, i) => prof[i] % 2 === 0).map((l) => geom2.fromPoints(ccw(l)))
  const huecos = validos.filter((_, i) => prof[i] % 2 === 1).map((l) => geom2.fromPoints(ccw(l)))
  if (!exteriores.length) return null
  let f = exteriores.length > 1 ? union(...exteriores) : exteriores[0]
  if (huecos.length) f = subtract(f, ...huecos)
  return f
}

// Contornos de una figura. geom2.toOutlines exige que cada lado empate
// exacto con el siguiente; después de un offset o una resta a veces quedan a
// micras y truena. En ese caso se arman a mano, uniendo lados con tolerancia,
// y se descarta el lazo que no cierre en vez de tirar toda la herramienta.
function contornosDe(g: ReturnType<typeof geom2.create>): P[][] {
  try {
    return geom2
      .toOutlines(g)
      .map((o) => limpiarLazo(o.map((v) => [v[0], v[1]] as P)))
      .filter((o) => o.length >= 3)
  } catch {
    return contornosTolerantes(geom2.toSides(g) as unknown as [P, P][])
  }
}

function contornosTolerantes(lados: [P, P][]): P[][] {
  const TOL = 1e-3
  const clave = (p: P) => `${Math.round(p[0] / TOL)},${Math.round(p[1] / TOL)}`
  const porInicio = new Map<string, number[]>()
  lados.forEach(([a], i) => {
    const k = clave(a)
    porInicio.set(k, [...(porInicio.get(k) || []), i])
  })
  const usado = new Array(lados.length).fill(false)
  const lazos: P[][] = []
  for (let i = 0; i < lados.length; i++) {
    if (usado[i]) continue
    const lazo: P[] = []
    let j = i
    const inicio = clave(lados[i][0])
    while (j >= 0 && !usado[j]) {
      usado[j] = true
      lazo.push(lados[j][0])
      const fin = clave(lados[j][1])
      if (fin === inicio) break
      const sig = (porInicio.get(fin) || []).find((n) => !usado[n])
      j = sig === undefined ? -1 : sig
    }
    const limpio = limpiarLazo(lazo)
    if (limpio.length >= 3 && Math.abs(area(limpio)) > 0.05) lazos.push(limpio)
  }
  return lazos
}

// Distancia de un punto a un segmento
function distSeg(p: P, a: P, b: P) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

// Un punto dentro de la figura y lejos de sus orillas, para el barreno del
// cable. Prefiere la parte baja de la letra, por donde sale mejor el cable.
function puntoInterior(g: ReturnType<typeof geom2.create>, radio: number): P | null {
  const lazos = contornosDe(g)
  if (!lazos.length) return null
  const todos = lazos.flat()
  const x0 = Math.min(...todos.map((q) => q[0])), x1 = Math.max(...todos.map((q) => q[0]))
  const y0 = Math.min(...todos.map((q) => q[1])), y1 = Math.max(...todos.map((q) => q[1]))
  let mejor: P | null = null
  let puntaje = -Infinity
  const N = 24
  for (let a = 1; a < N; a++) {
    for (let b = 1; b < N; b++) {
      const p: P = [x0 + ((x1 - x0) * a) / N, y0 + ((y1 - y0) * b) / N]
      if (lazos.filter((l) => dentro(p, l)).length % 2 !== 1) continue
      let d = Infinity
      for (const l of lazos) for (let i = 0, j = l.length - 1; i < l.length; j = i++) d = Math.min(d, distSeg(p, l[j], l[i]))
      if (d < radio + 1.5) continue
      // cerca del fondo pesa más que lejos de la orilla
      const s = -((p[1] - y0) / (y1 - y0 || 1)) * 3 + Math.min(d, radio * 3) / (radio * 3)
      if (s > puntaje) {
        puntaje = s
        mejor = p
      }
    }
  }
  return mejor
}

const circulo = (cx: number, cy: number, r: number, m = 32): P[] =>
  Array.from({ length: m }, (_, j) => [cx + r * Math.cos((2 * Math.PI * j) / m), cy + r * Math.sin((2 * Math.PI * j) / m)] as P)

// ---------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------

function altoMayuscula(fuente: Fuente): number {
  const lazos = aplanarComandos(fuente.charToGlyph("H").getPath(0, 0, fuente.unitsPerEm).commands as Cmd[])
  const ys = lazos.flat().map((p) => p[1])
  const h = ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  return h > 0 ? h : fuente.unitsPerEm * 0.7
}

export function hacerLetras3D(fuente: Fuente, o: OpcionesLetras3D): ResultadoLetras3D {
  const avisos: string[] = []
  const vacio = (e: string): ResultadoLetras3D => ({ piezas: [], ancho: 0, alto: 0, capasPared: 0, profundidadReal: 0, avisos, errores: [e] })
  const texto = o.texto.replace(/\s+/g, " ").trim()
  if (!texto) return vacio("Escribe el texto de las letras.")
  if (!(o.alto >= 20)) return vacio("Las letras deben medir al menos 20 mm de alto.")
  if (!(o.espesor > 0) || !(o.espesorFrente > 0)) return vacio("Escribe el espesor del material.")
  if (!(o.pared >= 2)) return vacio("La pared debe medir al menos 2 mm.")

  const tam = (o.alto * fuente.unitsPerEm) / altoMayuscula(fuente)
  const k = tam / fuente.unitsPerEm
  const glifos = fuente.stringToGlyphs(texto)
  const chars = Array.from(texto)

  const frenteAcrilico = o.construccion !== "mdf"
  const todoAcrilico = o.construccion === "acrilico"
  const espFondo = o.espesor
  const espPared = o.espesor
  const huecoTotal = o.profundidad - o.espesorFrente - espFondo
  const capasPared = Math.max(1, Math.round(huecoTotal / espPared))
  const profundidadReal = o.espesorFrente + espFondo + capasPared * espPared
  if (Math.abs(profundidadReal - o.profundidad) > 0.5) {
    avisos.push(`Con material de ${o.espesor} mm la letra queda de ${profundidadReal.toFixed(1)} mm de fondo (${capasPared} ${capasPared === 1 ? "capa" : "capas"} de pared).`)
  }

  const piezas: PiezaLetra[] = []
  let x = 0
  let sinPared = 0
  glifos.forEach((g, i) => {
    const letra = chars[i] ?? "?"
    const lazos = aplanarComandos(g.getPath(x, 0, tam).commands as Cmd[])
    x += (g.advanceWidth ?? 0) * k + o.espaciado
    if (i < glifos.length - 1) x += fuente.getKerningValue(g, glifos[i + 1]) * k
    if (!lazos.length) return // espacio
    const figura = aFigura(lazos)
    if (!figura) return

    // hueco interior: la letra encogida el ancho de la pared
    const interior = offset({ delta: -o.pared, corners: "round", segments: 16 }, figura)
    const contInterior = contornosDe(interior)
    const anillo = contInterior.length ? subtract(figura, interior) : figura
    if (!contInterior.length) sinPared++

    const id = `${i}-${letra}`
    const contFigura = contornosDe(figura)

    // fondo, con barreno para el cable dentro del hueco
    let contFondo = contFigura
    if (o.cable > 0 && contInterior.length) {
      const p = puntoInterior(interior, o.cable / 2)
      if (p) contFondo = [...contFigura, circulo(p[0], p[1], o.cable / 2)]
    }

    piezas.push({ id: `${id}-fondo`, letra, rol: "fondo", material: todoAcrilico ? "Acrílico" : "MDF", espesor: espFondo, cantidad: 1, contornos: contFondo, z: 0 })
    piezas.push({
      id: `${id}-pared`,
      letra,
      rol: "pared",
      material: todoAcrilico ? "Acrílico" : "MDF",
      espesor: espPared,
      cantidad: capasPared,
      contornos: contornosDe(anillo),
      z: espFondo,
    })
    piezas.push({
      id: `${id}-frente`,
      letra,
      rol: "frente",
      material: frenteAcrilico ? "Acrílico" : "MDF",
      espesor: o.espesorFrente,
      cantidad: 1,
      contornos: contFigura,
      z: espFondo + capasPared * espPared,
    })
  })

  if (!piezas.length) return vacio("La tipografía no tiene esas letras.")
  if (sinPared) avisos.push(`${sinPared === 1 ? "Una letra es" : `${sinPared} letras son`} tan delgada${sinPared === 1 ? "" : "s"} que no le cabe hueco: sale sólida. Baja el ancho de pared o sube el alto.`)

  const todos = piezas.flatMap((p) => p.contornos.flat())
  const xs = todos.map((p) => p[0])
  const ys = todos.map((p) => p[1])
  const ancho = Math.max(...xs) - Math.min(...xs)
  const alto = Math.max(...ys) - Math.min(...ys)
  if (o.pared * 2 > o.alto * 0.25) avisos.push("La pared es gruesa para ese tamaño de letra: quedará poco espacio para los LED.")
  return { piezas, ancho, alto, capasPared, profundidadReal, avisos, errores: [] }
}

// ---------------------------------------------------------------------
// Salidas
// ---------------------------------------------------------------------

/** Cada pieza como Dibujo en su origen, para anidar en la hoja. */
export function piezaComoDibujo(p: PiezaLetra): Dibujo {
  const pts = p.contornos.flat()
  const x0 = Math.min(...pts.map((q) => q[0]))
  const y0 = Math.min(...pts.map((q) => q[1]))
  const trazos: Trazo[] = p.contornos.map((c) => ({ pts: c.map(([x, y]) => [x - x0, y - y0] as P), cerrado: true, capa: "CORTE" }))
  return { trazos, avisos: [], unidades: "mm" }
}

// Triangula una figura plana con huecos y la extruye (sólo para la vista 3D;
// los archivos de corte salen de los contornos 2D). Se hace con el
// triangulador de three.js y no con extrudeLinear de jscad: el de jscad
// truena con letras como Q, S, a, 3 o & después de las restas.
const areaFirmada = (p: P[]) => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]
    const [x2, y2] = p[(i + 1) % p.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

function extruirContornos(contornos: P[][], z0: number, h: number, tris: number[]) {
  const lazos = contornos.map(limpiarLazo).filter((l) => l.length >= 3 && Math.abs(areaFirmada(l)) > 0.05)
  if (!lazos.length) return
  const prof = lazos.map((l, i) => lazos.filter((o, j) => j !== i && dentro(l[0], o)).length)
  const z1 = z0 + h

  const tri = (a: number[], b: number[], c: number[], nx: number, ny: number, nz: number) => {
    // Orienta el triángulo hacia afuera del sólido
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    if (cx * nx + cy * ny + cz * nz < 0) tris.push(...a, ...c, ...b)
    else tris.push(...a, ...b, ...c)
  }

  lazos.forEach((ext, i) => {
    if (prof[i] % 2 !== 0) return
    // Exterior en sentido antihorario y sus huecos directos en horario
    const exterior = areaFirmada(ext) > 0 ? ext : [...ext].reverse()
    const huecos = lazos
      .filter((l, j) => j !== i && prof[j] === prof[i] + 1 && dentro(l[0], ext))
      .map((l) => (areaFirmada(l) < 0 ? l : [...l].reverse()))

    const v2 = (l: P[]) => l.map(([x, y]) => new Vector2(x, y))
    const caras = ShapeUtils.triangulateShape(v2(exterior), huecos.map(v2))
    const todos = [...exterior, ...huecos.flat()]
    for (const [a, b, c] of caras) {
      const A = todos[a], B = todos[b], C = todos[c]
      tri([A[0], A[1], z1], [B[0], B[1], z1], [C[0], C[1], z1], 0, 0, 1)
      tri([A[0], A[1], z0], [B[0], B[1], z0], [C[0], C[1], z0], 0, 0, -1)
    }

    // Paredes: con exterior antihorario y huecos horarios, (dy, -dx) apunta
    // siempre hacia afuera del material.
    for (const l of [exterior, ...huecos]) {
      for (let k = 0; k < l.length; k++) {
        const p = l[k], q = l[(k + 1) % l.length]
        const nx = q[1] - p[1], ny = -(q[0] - p[0])
        tri([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], nx, ny, 0)
        tri([p[0], p[1], z0], [q[0], q[1], z1], [p[0], p[1], z1], nx, ny, 0)
      }
    }
  })
}

/** Malla 3D de todas las letras armadas (Z hacia arriba = fondo de la letra). */
export function mallaLetras(r: ResultadoLetras3D, separar = 0): { tris: number[]; acrilico: number[] } {
  const tris: number[] = []
  const acrilico: number[] = []
  for (const p of r.piezas) {
    const destino = p.material === "Acrílico" ? acrilico : tris
    if (p.rol === "pared") {
      for (let n = 0; n < p.cantidad; n++) extruirContornos(p.contornos, p.z + n * p.espesor + separar * (n + 1), p.espesor, destino)
    } else {
      const extra = p.rol === "frente" ? separar * (r.capasPared + 2) : 0
      extruirContornos(p.contornos, p.z + extra, p.espesor, destino)
    }
  }
  return { tris, acrilico }
}

/** Lista de materiales: cuánto de cada uno, en piezas. */
export function resumenMateriales(r: ResultadoLetras3D) {
  const por: Record<string, number> = {}
  for (const p of r.piezas) {
    const k = `${p.material} ${p.espesor} mm`
    por[k] = (por[k] || 0) + p.cantidad
  }
  return por
}

export type { Malla }
