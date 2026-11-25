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
  tris: number[]
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

type Geom = ReturnType<typeof geom2.create>

const caja = (c: P[][]) => {
  const xs = c.flat().map((p) => p[0]), ys = c.flat().map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/** ¿El punto está dentro del polígono? (par-impar) */
function dentroDe([x, y]: P, poly: P[]) {
  let d = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d
  }
  return d
}

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
  const b = caja(c)
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

export function hacerLetrasImpresion(fuente: Fuente, o: OpcionesImpresion): ResultadoImpresion {
  const avisos: string[] = []
  const vacio = (e: string): ResultadoImpresion => ({ tris: [], letras: [], barrenos: [], ancho: 0, alto: 0, profundidadTotal: 0, piezas: 0, avisos, errores: [e] })
  const texto = o.texto.replace(/\s+/g, " ").trim()
  if (!texto) return vacio("Escribe el texto de las letras.")
  if (!(o.alto >= 15)) return vacio("Las letras deben medir al menos 15 mm de alto.")
  if (!(o.profundidad >= 3)) return vacio("La letra debe tener al menos 3 mm de grosor.")

  const figuras = figurasDeTexto(fuente, texto, o.alto, o.espaciado)
  if (!figuras.length) return vacio("La tipografía no tiene esas letras.")
  const letras = figuras.map((f) => ({ letra: f.letra, contornos: contornosDe(f.figura) })).filter((l) => l.contornos.length)
  const todo = caja(letras.flatMap((l) => l.contornos))
  const ancho = todo.x1 - todo.x0
  const alto = todo.y1 - todo.y0
  const tris: number[] = []
  const barrenos: MarcaMontaje[] = []
  let profundidadTotal = o.profundidad
  let piezas = letras.length

  if (o.estilo === "pie") {
    // Letras paradas: el dibujo (x, y) pasa a (x, z) y el grosor va en Y.
    // La base las une: queda una sola pieza.
    // (x, y, z) → (x, z, y) es un espejo: se invierte el orden de cada
    // triángulo para que las caras sigan mirando hacia afuera
    const pegar = (t: number[]) => {
      const v = (j: number) => [t[j], t[j + 2] - o.profundidad / 2, t[j + 1] - todo.y0 + BASE_ALTO]
      for (let i = 0; i < t.length; i += 9) tris.push(...v(i), ...v(i + 6), ...v(i + 3))
    }
    for (const l of letras) pegar(prisma(l.contornos, o.profundidad))
    const m = 6
    const fondo = o.profundidad + 2 * BASE_FONDO
    tris.push(...prisma([[[todo.x0 - m, -fondo / 2], [todo.x1 + m, -fondo / 2], [todo.x1 + m, fondo / 2], [todo.x0 - m, fondo / 2]]], BASE_ALTO))
    profundidadTotal = fondo
    piezas = 1
    // letras que no tocan la base (puntos de la i, acentos) quedan sueltas
    // (sólo contornos exteriores: el hueco de la O o la A no cuenta)
    const sueltas = letras.flatMap((l) =>
      l.contornos
        .filter((c, i) => !l.contornos.some((otro, j) => j !== i && dentroDe(c[0], otro)))
        .filter((c) => Math.min(...c.map((p) => p[1])) > todo.y0 + o.alto * 0.08)
        .map(() => l.letra)
    )
    if (sueltas.length) avisos.push(`Los puntos y acentos (${[...new Set(sueltas)].join(" ")}) no tocan la base: se imprimen sueltos y se pegan, o escribe sin acentos.`)
  } else if (o.estilo === "pared") {
    // Boca abajo: el frente en la cama (z = 0). Atrás (arriba) los barrenos
    // ciegos: 60 % del grosor, sin pasar al frente.
    const r = Math.max(2, o.barreno / 2)
    const hondo = Math.min(o.profundidad - 1.6, Math.max(4, o.profundidad * 0.6))
    const solido = o.profundidad - hondo
    figuras.forEach((f) => {
      const c = contornosDe(f.figura)
      if (!c.length) return
      const hoyos = barrenosDe(f.figura, r)
      // espejo en X: boca abajo, para que vista de frente se lea al derecho
      const espejo = (pts: P[][]) => pts.map((p) => p.map(([x, y]) => [-x, y] as P).reverse())
      tris.push(...prisma(espejo(c), solido))
      const atras = hoyos.length ? contornosDe(subtract(f.figura, ...hoyos.map(([x, y]) => geom2.fromPoints(circulo(x, y, r, 28))))) : c
      tris.push(...prisma(espejo(atras), hondo, solido))
      for (const [x, y] of hoyos) barrenos.push({ letra: f.letra, x, y })
      if (!hoyos.length) avisos.push(`La «${f.letra}» es muy delgada para el barreno: cuélgala con cinta doble cara.`)
    })
  } else {
    // Hueca para LED: frente sólido delgado (en la cama) y paredes
    const pared = Math.max(1.2, o.pared)
    const frente = Math.max(0.8, Math.min(o.frente, o.profundidad - 1))
    let sinHueco = 0
    figuras.forEach((f) => {
      const c = contornosDe(f.figura)
      if (!c.length) return
      const espejo = (pts: P[][]) => pts.map((p) => p.map(([x, y]) => [-x, y] as P).reverse())
      tris.push(...prisma(espejo(c), frente))
      const interior = offset({ delta: -pared, corners: "round", segments: 16 }, f.figura)
      const ci = contornosDe(interior)
      if (!ci.length) sinHueco++
      const anillo = ci.length ? contornosDe(subtract(f.figura, interior)) : c
      tris.push(...prisma(espejo(anillo), o.profundidad - frente, frente))
    })
    if (sinHueco) avisos.push(`${sinHueco === 1 ? "Una letra es" : `${sinHueco} letras son`} tan delgada${sinHueco === 1 ? "" : "s"} que no le cabe el LED: sale sólida. Sube el alto o baja la pared.`)
    if (o.alto < 60) avisos.push("Para que quepa la tira LED, las letras huecas funcionan mejor desde 60 mm de alto.")
  }

  return { tris, letras, barrenos, ancho, alto, profundidadTotal, piezas, avisos, errores: [] }
}
