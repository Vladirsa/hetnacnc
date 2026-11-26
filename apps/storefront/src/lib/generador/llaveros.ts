// Llaveros y placas con nombre: el texto va sobre una placa (rectángulo,
// óvalo, círculo, etiqueta o corazón) con su agujero para la argolla.
//  - Para láser: DXF/SVG con capa CORTE (placa y agujero) y capa GRABADO (texto).
//  - Para impresión 3D: STL con la placa y las letras en relieve.
// Todo en milímetros, Y hacia arriba, calculado en el navegador.
//
// 25 nov 2026: los renglones después del primero pueden ir más chicos (el
// teléfono en la placa de mascota), y a la izquierda del texto puede ir un
// ícono y/o el logo del cliente (contornos sacados de su imagen).

import { extruir } from "@/lib/generador/extruir"
import { caja } from "@/lib/generador/geo2d"
import { unirContornos } from "@/lib/generador/unirContornos"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import type { Curva, Pt } from "@/lib/generador/trazado"
import { type Dibujo, type Malla, type P, type Trazo, conPartes } from "@/lib/generador/vectores"
import { figura, type IconoTextura } from "@/lib/generador/texturizador"

export type FormaLlavero = "rect" | "ovalo" | "circulo" | "etiqueta" | "corazon"

export const FORMAS_LLAVERO: { id: FormaLlavero; nombre: string }[] = [
  { id: "rect", nombre: "Rectángulo" },
  { id: "ovalo", nombre: "Óvalo" },
  { id: "circulo", nombre: "Círculo" },
  { id: "etiqueta", nombre: "Etiqueta" },
  { id: "corazon", nombre: "Corazón" },
]

/** Lo que la herramienta trae de fábrica (también lo usa el catálogo de impresión). */
export const OPCIONES_LLAVERO_FABRICA = { espaciado: 0, margen: 4, radio: 5, argolla: 4.5, grosor: 3, relieve: 1.5 }

export type OpcionesLlavero = {
  texto: string
  alto: number // alto de la letra mayúscula (mm)
  espaciado: number
  forma: FormaLlavero
  margen: number // espacio entre el texto y la orilla
  radio: number // esquinas del rectángulo / etiqueta
  argolla: number // diámetro del agujero (0 = sin agujero)
  grosor: number // placa (STL)
  relieve: number // letras sobre la placa (STL)
  /** % del alto para los renglones después del primero (100 = mismo tamaño) */
  escalaRenglones?: number
  /** ícono a la izquierda del texto */
  icono?: IconoTextura | ""
  /** logo del cliente: contornos en cualquier escala (Y hacia arriba); se ajusta a altoLogo */
  logo?: P[][] | null
  /** alto del logo y del ícono en mm (0 = el del bloque de texto) */
  altoLogo?: number
}

export type ResultadoLlavero = {
  dibujo: Dibujo // CORTE + GRABADO
  malla: Malla // STL: placa + letras
  ancho: number
  alto: number
  avisos: string[]
  errores: string[]
}

// curva (bezier) → puntos, con Y volteada (la fuente dibuja hacia abajo)
export function aplanar(c: Curva, paso = 0.3): P[] {
  const pts: P[] = [[c.inicio[0], -c.inicio[1]]]
  let a: Pt = c.inicio
  for (const t of c.tramos) {
    if ("c1" in t) {
      const L = Math.hypot(t.c1[0] - a[0], t.c1[1] - a[1]) + Math.hypot(t.c2[0] - t.c1[0], t.c2[1] - t.c1[1]) + Math.hypot(t.p[0] - t.c2[0], t.p[1] - t.c2[1])
      const n = Math.max(2, Math.min(48, Math.ceil(L / paso)))
      for (let i = 1; i <= n; i++) {
        const s = i / n
        const u = 1 - s
        pts.push([
          u * u * u * a[0] + 3 * u * u * s * t.c1[0] + 3 * u * s * s * t.c2[0] + s * s * s * t.p[0],
          -(u * u * u * a[1] + 3 * u * u * s * t.c1[1] + 3 * u * s * s * t.c2[1] + s * s * s * t.p[1]),
        ])
      }
    } else pts.push([t.p[0], -t.p[1]])
    a = t.p
  }
  // quitar el cierre repetido
  const q = pts[pts.length - 1]
  if (pts.length > 1 && Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < 1e-4) pts.pop()
  return pts
}

const circulo = (cx: number, cy: number, r: number, m = 48): P[] =>
  Array.from({ length: m }, (_, j) => [cx + r * Math.cos((2 * Math.PI * j) / m), cy + r * Math.sin((2 * Math.PI * j) / m)] as P)

const elipse = (cx: number, cy: number, rx: number, ry: number, m = 64): P[] =>
  Array.from({ length: m }, (_, j) => [cx + rx * Math.cos((2 * Math.PI * j) / m), cy + ry * Math.sin((2 * Math.PI * j) / m)] as P)

function rectRedondo(x0: number, y0: number, x1: number, y1: number, r: number): P[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2))
  if (r < 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const pts: P[] = []
  const esq: [number, number, number][] = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]
  for (const [cx, cy, a0] of esq) for (let j = 0; j <= 8; j++) pts.push([cx + r * Math.cos(a0 + (Math.PI / 2) * (j / 8)), cy + r * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
  return pts
}

// Corazón centrado en (cx, cy) que mide w × h
function corazon(cx: number, cy: number, w: number, h: number): P[] {
  const pts: P[] = []
  const n = 72
  for (let j = 0; j < n; j++) {
    const t = (2 * Math.PI * j) / n
    // curva clásica del corazón, normalizada a [-1,1]
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push([cx + (x / 16) * (w / 2), cy + ((y + 2) / 15) * (h / 2)])
  }
  return pts
}

// Etiqueta: rectángulo con un extremo en punta (donde va la argolla)
function etiqueta(x0: number, y0: number, x1: number, y1: number, r: number, punta: number): P[] {
  const cy = (y0 + y1) / 2
  const pts: P[] = []
  // lado derecho redondeado
  const esq: [number, number, number][] = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0]]
  for (const [ex, ey, a0] of esq) for (let j = 0; j <= 8; j++) pts.push([ex + r * Math.cos(a0 + (Math.PI / 2) * (j / 8)), ey + r * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
  pts.push([x0 + punta, y1], [x0, cy], [x0 + punta, y0])
  return pts
}

const cajaDe = (c: P[][]) => caja(c.flat())
const mover = (c: P[][], dx: number, dy: number, k = 1): P[][] => c.map((p) => p.map(([x, y]) => [x * k + dx, y * k + dy] as P))

/**
 * Texto (renglones 2+ con su escala), y a la izquierda el logo y el ícono, en
 * mm. `figura[i]` dice si el contorno i es del ícono o el logo (para que en una
 * impresora de varios colores vayan de su propio color).
 */
function contenido(fuente: Fuente, o: OpcionesLlavero): { contornos: P[][]; figura: boolean[] } {
  const partes: P[][][] = []
  const deFigura: boolean[] = []
  // Texto: el primer renglón al alto pedido y los demás a escalaRenglones %
  const renglones = o.texto.replace(/\r/g, "").split("\n")
  const escala = Math.max(0.3, Math.min(1, (o.escalaRenglones ?? 100) / 100))
  let bloque: P[][] = []
  let y = 0
  renglones.forEach((r, j) => {
    if (!r.trim()) return
    const alto = j === 0 ? o.alto : o.alto * escala
    const t = textoACurvas(fuente, { texto: r, alto, espaciado: o.espaciado, interlineado: 1.4, alineacion: "centro" })
    const c = t.curvas.map((x) => aplanar(x)).filter((p) => p.length >= 3)
    if (!c.length) return
    const b = cajaDe(c)
    // cada renglón centrado en x y debajo del anterior (separación de 40 % de su alto)
    if (bloque.length) y -= alto * 0.4
    bloque = [...bloque, ...mover(c, -(b.x0 + b.x1) / 2, y - b.y1)]
    y -= b.y1 - b.y0
  })
  // unidas: en letra cursiva las letras se enciman y, sin unir, se "borran" pedazos
  if (bloque.length) {
    partes.push(unirContornos(bloque))
    deFigura.push(false)
  }
  const altoBloque = partes.length ? (() => { const b = cajaDe(partes[0]); return b.y1 - b.y0 })() : o.alto
  const altoFig = o.altoLogo && o.altoLogo > 0 ? o.altoLogo : Math.max(o.alto, altoBloque)
  const aIzquierda = (c: P[][]) => {
    if (!c.length) return
    const b = cajaDe(c)
    const k = altoFig / Math.max(1e-6, b.y1 - b.y0)
    const fig = mover(c, -b.x0 * k, -((b.y0 + b.y1) / 2) * k, k)
    if (!partes.length) {
      partes.push(fig)
      deFigura.push(true)
      return
    }
    // pegado a la izquierda de lo que ya hay, con un hueco de 25 % del alto
    const actual = cajaDe(partes.flat())
    const fb = cajaDe(fig)
    partes.unshift(mover(fig, actual.x0 - altoFig * 0.25 - fb.x1, (actual.y0 + actual.y1) / 2))
    deFigura.unshift(true)
  }
  if (o.icono) aIzquierda(unirContornos(figura(o.icono)))
  if (o.logo?.length) aIzquierda(o.logo)
  return { contornos: partes.flat(), figura: partes.flatMap((g, i) => g.map(() => deFigura[i])) }
}

export function hacerLlavero(fuente: Fuente, o: OpcionesLlavero): ResultadoLlavero {
  const errores: string[] = []
  const avisos: string[] = []
  const vacio = (e: string): ResultadoLlavero => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, malla: { tris: [], avisos: [] }, ancho: 0, alto: 0, avisos, errores: [e] })
  const hayLogo = !!o.logo?.length
  if (!o.texto.trim() && !hayLogo && !o.icono) return vacio("Escribe el nombre o texto del llavero.")
  if (!(o.alto > 0)) return vacio("Escribe el alto de las letras.")

  const { contornos: letras, figura: esFigura } = contenido(fuente, o)
  if (!letras.length) return vacio(o.texto.trim() ? "La tipografía no tiene esas letras." : "El logo no tiene contornos: prueba con una imagen de más contraste.")
  const { x0: tx0, x1: tx1, y0: ty0, y1: ty1 } = cajaDe(letras)
  const tw = tx1 - tx0, th = ty1 - ty0
  const m = Math.max(1, o.margen)
  const d = Math.max(0, o.argolla)
  const zona = d > 0 ? d + 2 * 2.2 : 0 // ancho que ocupa la argolla con su pared

  // centro del contenido en el origen
  const texto = mover(letras, -(tx0 + tx1) / 2, -(ty0 + ty1) / 2)

  let placa: P[]
  let hoyo: P[] | null = null
  let ancho = 0, alto = 0
  const arriba = o.forma === "circulo" || o.forma === "corazon"
  if (o.forma === "rect" || o.forma === "etiqueta") {
    const w = tw + 2 * m + zona
    const h = Math.max(th + 2 * m, d > 0 ? d + 2 * 2.2 : 0)
    const x0 = -tw / 2 - m - zona
    const x1 = tw / 2 + m
    placa = o.forma === "rect" ? rectRedondo(x0, -h / 2, x1, h / 2, o.radio) : etiqueta(x0, -h / 2, x1, h / 2, o.radio, Math.min(h / 2, zona + 2))
    if (d > 0) hoyo = circulo(x0 + zona / 2 + (o.forma === "etiqueta" ? 1.5 : 0), 0, d / 2)
    ancho = w
    alto = h
  } else if (o.forma === "ovalo") {
    const rx = (tw / 2 + m) * 1.12 + zona / 2
    const ry = (th / 2 + m) * 1.25
    placa = elipse(-zona / 2, 0, rx, ry)
    if (d > 0) hoyo = circulo(-zona / 2 - rx + d / 2 + 2.2, 0, d / 2)
    ancho = 2 * rx
    alto = 2 * ry
  } else if (o.forma === "circulo") {
    const r = Math.hypot(tw / 2, th / 2) + m
    placa = circulo(0, 0, r)
    if (d > 0) {
      // orejita arriba para la argolla
      const oreja = circulo(0, r - 0.5, zona / 2)
      placa = unirConvexo([...placa, ...oreja])
      hoyo = circulo(0, r - 0.5 + 0.3, d / 2)
    }
    ancho = 2 * r
    alto = 2 * r + (d > 0 ? zona / 2 : 0)
  } else {
    const w = (tw + 2 * m) * 1.25
    const h = Math.max(th + 2 * m, w * 0.9) * 1.15
    placa = corazon(0, -h * 0.05, w, h)
    if (d > 0) hoyo = circulo(-w * 0.3, h * 0.39 - d / 2 - 2.2, d / 2)
    ancho = w
    alto = h
  }

  const trazos: Trazo[] = [{ pts: placa, cerrado: true, capa: "CORTE" }]
  if (hoyo) trazos.push({ pts: hoyo, cerrado: true, capa: "CORTE" })
  for (const p of texto) trazos.push({ pts: p, cerrado: true, capa: "GRABADO" })
  const dibujo: Dibujo = { trazos, avisos: [], unidades: "mm" }

  // STL: placa con agujero + letras encima. Cada pieza por separado (placa,
  // letras, ícono/logo) para las impresoras de varios colores.
  const extruirEn = (pts: P[][], alto: number, z0: number) => {
    if (!pts.length || !(alto > 0)) return []
    const t = extruir({ trazos: pts.map((q) => ({ pts: q, cerrado: true, capa: "X" })), avisos: [], unidades: "mm" }, { alto, base: 0, margenBase: 0, redondearBase: 0, espejo: false }).malla.tris
    if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0
    return t
  }
  const malla =
    o.grosor > 0
      ? conPartes(
          ["Placa", extruirEn(hoyo ? [placa, hoyo] : [placa], o.grosor, 0)],
          ["Letras", extruirEn(texto.filter((_, i) => !esFigura[i]), o.relieve, o.grosor)],
          ["Ícono y logo", extruirEn(texto.filter((_, i) => esFigura[i]), o.relieve, o.grosor)]
        )
      : { tris: [], avisos: [] }
  if (!arriba && d > 0 && th + 2 * m < d + 4.4) avisos.push("La placa es muy delgada para la argolla: sube el margen o baja el diámetro.")
  return { dibujo, malla, ancho, alto, avisos, errores }
}

// Envolvente convexa (círculo + orejita) — sencillo y suficiente aquí
function unirConvexo(pts: P[]): P[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const inf: P[] = []
  for (const q of p) {
    while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], q) <= 0) inf.pop()
    inf.push(q)
  }
  const sup: P[] = []
  for (const q of [...p].reverse()) {
    while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], q) <= 0) sup.pop()
    sup.push(q)
  }
  return [...inf.slice(0, -1), ...sup.slice(0, -1)]
}
