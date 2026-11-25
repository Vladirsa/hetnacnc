// Letras 3D para IMPRESORA 3D (la versión por capas para router y láser está
// en letras3d.ts). Tres estilos:
//
//   pie    ── letras de mostrador: paradas sobre una base que las une (una sola
//            pieza). Se imprime tal cual: la base en la cama.
//   pared  ── letras sueltas para colgar: cada una con 1 o 2 barrenos ciegos
//            atrás para el clavo o la pija (no se ven por el frente). Se
//            imprimen boca abajo. Sale la plantilla de montaje (PDF a tamaño real).
//   luz    ── letras huecas para LED: frente delgado (que pase la luz con
//            filamento blanco o natural) y paredes; atrás quedan abiertas para
//            meter la tira. Se imprimen con el frente en la cama.
//
// Todo en milímetros, Y hacia arriba en el dibujo; Z es la altura de impresión.
import * as jscad from "@jscad/modeling"

import { extruir } from "@/lib/generador/extruir"
import { caja, dentro } from "@/lib/generador/geo2d"
import { circulo, contornosDe, figurasDeTexto, puntoInterior } from "@/lib/generador/letras3d"
import type { Fuente } from "@/lib/generador/letreros"
import type { P } from "@/lib/generador/vectores"

const { geom2 } = jscad.geometries
const { subtract, intersect } = jscad.booleans
const { offset } = jscad.expansions

export type EstiloImpresion = "pie" | "pared" | "luz"

export const ESTILOS_IMPRESION: { id: EstiloImpresion; nombre: string; detalle: string }[] = [
  { id: "pie", nombre: "De pie con base", detalle: "Para mostrador o escritorio, en una pieza" },
  { id: "pared", nombre: "Para colgar", detalle: "Sueltas, con barrenos ocultos atrás" },
  { id: "luz", nombre: "Huecas para LED", detalle: "Frente delgado y atrás abierto" },
]

/** Lo que la herramienta trae de fábrica (también lo usa el catálogo de impresión). */
export const OPCIONES_IMPRESION_FABRICA = { espaciado: 3, barreno: 8, pared: 1.6, frente: 1.2 }

export type OpcionesImpresion = {
  texto: string
  alto: number // alto de la letra mayúscula, mm
  espaciado: number // entre letras, mm
  profundidad: number // grosor de la letra, mm
  estilo: EstiloImpresion
  /** pared: diámetro del barreno para la cabeza del clavo o pija (mm) */
  barreno: number
  /** luz: grosor de las paredes y del frente (mm) */
  pared: number
  frente: number
}

/** Un barreno de la plantilla (centro en mm, en el mismo sistema que la letra) */
export type MarcaMontaje = { letra: string; x: number; y: number }

export type ResultadoImpresion = {
  /** como se imprime (pared y luz: boca abajo y en espejo) */
  tris: number[]
  /** de frente, para verla (Y arriba = alto de la letra; Z = grosor hacia el que mira) */
  trisVista: number[]
  /** contornos de cada letra (plantilla de montaje y vista 2D) */
  letras: { letra: string; contornos: P[][] }[]
  barrenos: MarcaMontaje[]
  ancho: number
  alto: number
  profundidadTotal: number
  piezas: number
  avisos: string[]
  errores: string[]
}

const BASE_ALTO = 4 // mm de la base del estilo "pie"
const BASE_FONDO = 12 // lo que sobresale la base por delante y por detrás
/** Cama de una impresora común (mm): más larga, la pieza de una sola vez no cabe */
export const MAX_CAMA = 250

type Geom = ReturnType<typeof geom2.create>

/** Extruye contornos (con huecos) de z0 a z0+alto. */
function prisma(contornos: P[][], alto: number, z0 = 0): number[] {
  if (!contornos.length || !(alto > 0)) return []
  const r = extruir({ trazos: contornos.map((pts) => ({ pts, cerrado: true, capa: "CORTE" })), avisos: [], unidades: "mm" }, { alto, base: 0, margenBase: 0, redondearBase: 0, espejo: false })
  const t = r.malla.tris
  if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0
  return t
}

/** 1 o 2 barrenos dentro de la letra (2 si es ancha), lejos de las orillas. */
function barrenosDe(figura: Geom, radio: number): P[] {
  const c = contornosDe(figura)
  if (!c.length) return []
  const b = caja(c.flat())
  const ancho = b.x1 - b.x0
  if (ancho > (b.y1 - b.y0) * 0.9 && ancho > radio * 8) {
    // ancha (M, W, O): uno en cada mitad, para que no gire en la pared
    const mitad = (xa: number, xb: number) => intersect(figura, geom2.fromPoints([[xa, b.y0 - 1], [xb, b.y0 - 1], [xb, b.y1 + 1], [xa, b.y1 + 1]]))
    const pts = [mitad(b.x0 - 1, (b.x0 + b.x1) / 2), mitad((b.x0 + b.x1) / 2, b.x1 + 1)].map((g) => puntoMasAlto(g, radio)).filter((p): p is P => !!p)
    if (pts.length === 2) return pts
  }
  const p = puntoMasAlto(figura, radio)
  return p ? [p] : []
}

// puntoInterior prefiere la parte baja (para el cable); para colgar conviene
// arriba: se voltea la figura, se busca y se regresa
function puntoMasAlto(g: Geom, radio: number): P | null {
  const volteada = jscad.transforms.mirrorY(g)
  const p = puntoInterior(volteada, radio)
  return p ? [p[0], -p[1]] : null
}

// Boca abajo: espejo en X para que, vista de frente, se lea al derecho
const espejo = (pts: P[][]) => pts.map((p) => p.map(([x, y]) => [-x, y] as P).reverse())

/** De "como se imprime boca abajo" a "de frente": giro de 180° sobre Y (x → −x, z → grosor − z). */
function deFrente(t: number[], grosor: number): number[] {
  const r = t.slice()
  for (let i = 0; i < r.length; i += 3) {
    r[i] = -r[i]
    r[i + 2] = grosor - r[i + 2]
  }
  return r
}

/** Una malla acostada (Z = grosor) puesta de pie (Z = alto), para fotos: giro de 90° sobre X. */
export function pararMalla(t: number[]): number[] {
  const r = t.slice()
  for (let i = 0; i < r.length; i += 3) {
    const y = r[i + 1], z = r[i + 2]
    r[i + 1] = -z
    r[i + 2] = y
  }
  return r
}

type Letra = { letra: string; figura: Geom; contornos: P[][] }
type Armado = { tris: number[]; barrenos: MarcaMontaje[]; avisos: string[]; profundidadTotal: number; piezas: number }

// Letras paradas sobre una base que las une (una sola pieza). El dibujo (x, y)
// pasa a (x, z) y el grosor va en Y. Cada letra se baja hasta meterse
// TRASLAPE mm en la base: la O, la S o la V bajan un poco de la línea por
// diseño, y si todas se alinearan con ellas la H, la M o la E quedarían en el aire.
const TRASLAPE = 0.8

function armarPie(letras: Letra[], o: OpcionesImpresion): Armado {
  const todo = caja(letras.flatMap((l) => l.contornos.flat()))
  const tris: number[] = []
  const sueltas: string[] = []
  for (const l of letras) {
    // contornos exteriores (el hueco de la O o la A no cuenta)
    const exteriores = l.contornos.filter((c, i) => !l.contornos.some((otro, j) => j !== i && dentro(c[0], otro)))
    const piso = Math.min(...exteriores.map((c) => Math.min(...c.map((p) => p[1]))))
    // puntos de la i, acentos: piezas de la letra que no llegan al piso
    if (exteriores.some((c) => Math.min(...c.map((p) => p[1])) > piso + 0.5)) sueltas.push(l.letra)
    const dz = BASE_ALTO - TRASLAPE - piso
    // (x, y, z) → (x, z, y) es un espejo: se invierte el orden de cada
    // triángulo para que las caras sigan mirando hacia afuera
    const t = prisma(l.contornos, o.profundidad)
    const v = (j: number) => [t[j], t[j + 2] - o.profundidad / 2, t[j + 1] + dz]
    for (let i = 0; i < t.length; i += 9) tris.push(...v(i), ...v(i + 6), ...v(i + 3))
  }
  const m = 6
  const fondo = o.profundidad + 2 * BASE_FONDO
  tris.push(...prisma([[[todo.x0 - m, -fondo / 2], [todo.x1 + m, -fondo / 2], [todo.x1 + m, fondo / 2], [todo.x0 - m, fondo / 2]]], BASE_ALTO))
  const avisos = sueltas.length ? [`Los puntos y acentos (${[...new Set(sueltas)].join(" ")}) no tocan la base: se imprimen sueltos y se pegan, o escribe sin acentos.`] : []
  if (todo.x1 - todo.x0 + 2 * m > MAX_CAMA) avisos.push(`La base mide ${Math.round(todo.x1 - todo.x0 + 2 * m)} mm: no cabe en muchas impresoras (camas de 220 a 256 mm). Baja el alto o usa menos letras.`)
  return { tris, barrenos: [], avisos, profundidadTotal: fondo, piezas: 1 }
}

// Boca abajo: el frente en la cama (z = 0). Atrás (arriba) los barrenos
// ciegos: 60 % del grosor, sin pasar al frente.
function armarPared(letras: Letra[], o: OpcionesImpresion): Armado {
  const r = Math.max(2, o.barreno / 2)
  const hondo = Math.min(o.profundidad - 1.6, Math.max(4, o.profundidad * 0.6))
  const solido = o.profundidad - hondo
  const tris: number[] = [], barrenos: MarcaMontaje[] = [], avisos: string[] = []
  for (const l of letras) {
    const hoyos = barrenosDe(l.figura, r)
    tris.push(...prisma(espejo(l.contornos), solido))
    const atras = hoyos.length ? contornosDe(subtract(l.figura, ...hoyos.map(([x, y]) => geom2.fromPoints(circulo(x, y, r, 28))))) : l.contornos
    tris.push(...prisma(espejo(atras), hondo, solido))
    for (const [x, y] of hoyos) barrenos.push({ letra: l.letra, x, y })
    if (!hoyos.length) avisos.push(`La «${l.letra}» es muy delgada para el barreno: cuélgala con cinta doble cara.`)
  }
  return { tris, barrenos, avisos, profundidadTotal: o.profundidad, piezas: letras.length }
}

// Hueca para LED: frente sólido delgado (en la cama) y paredes; atrás abierta
function armarLuz(letras: Letra[], o: OpcionesImpresion): Armado {
  const pared = Math.max(1.2, o.pared)
  const frente = Math.max(0.8, Math.min(o.frente, o.profundidad - 1))
  const tris: number[] = [], avisos: string[] = []
  let sinHueco = 0
  for (const l of letras) {
    tris.push(...prisma(espejo(l.contornos), frente))
    const interior = offset({ delta: -pared, corners: "round", segments: 16 }, l.figura)
    const hueco = contornosDe(interior).length > 0
    if (!hueco) sinHueco++
    const anillo = hueco ? contornosDe(subtract(l.figura, interior)) : l.contornos
    tris.push(...prisma(espejo(anillo), o.profundidad - frente, frente))
  }
  if (sinHueco) avisos.push(`${sinHueco === 1 ? "Una letra es" : `${sinHueco} letras son`} tan delgada${sinHueco === 1 ? "" : "s"} que no le cabe el LED: sale sólida. Sube el alto o baja la pared.`)
  if (o.alto < 60) avisos.push("Para que quepa la tira LED, las letras huecas funcionan mejor desde 60 mm de alto.")
  return { tris, barrenos: [], avisos, profundidadTotal: o.profundidad, piezas: letras.length }
}

const ARMAR: Record<EstiloImpresion, (letras: Letra[], o: OpcionesImpresion) => Armado> = { pie: armarPie, pared: armarPared, luz: armarLuz }

export function hacerLetrasImpresion(fuente: Fuente, o: OpcionesImpresion): ResultadoImpresion {
  const vacio = (e: string): ResultadoImpresion => ({ tris: [], trisVista: [], letras: [], barrenos: [], ancho: 0, alto: 0, profundidadTotal: 0, piezas: 0, avisos: [], errores: [e] })
  const texto = o.texto.replace(/\s+/g, " ").trim()
  if (!texto) return vacio("Escribe el texto de las letras.")
  if (!(o.alto >= 15)) return vacio("Las letras deben medir al menos 15 mm de alto.")
  if (!(o.profundidad >= 3)) return vacio("La letra debe tener al menos 3 mm de grosor.")

  const letras: Letra[] = figurasDeTexto(fuente, texto, o.alto, o.espaciado)
    .map((f) => ({ letra: f.letra, figura: f.figura, contornos: contornosDe(f.figura) }))
    .filter((l) => l.contornos.length)
  if (!letras.length) return vacio("La tipografía no tiene esas letras.")
  const todo = caja(letras.flatMap((l) => l.contornos.flat()))
  const a = ARMAR[o.estilo](letras, o)
  return {
    tris: a.tris,
    trisVista: o.estilo === "pie" ? a.tris : deFrente(a.tris, o.profundidad),
    letras: letras.map(({ letra, contornos }) => ({ letra, contornos })),
    barrenos: a.barrenos,
    ancho: todo.x1 - todo.x0,
    alto: todo.y1 - todo.y0,
    profundidadTotal: a.profundidadTotal,
    piezas: a.piezas,
    avisos: a.avisos,
    errores: [],
  }
}
