// Texturizador: placa para imprimir en 3D con un patrón en relieve (palabras e
// íconos repetidos) que se presiona sobre arcilla polimérica, fondant, masa,
// jabón o cuero para dejarle la textura.
//
//  - El patrón se repite en filas; "intercalado" corre cada fila media pieza y
//    cambia el orden, como un papel tapiz. Lo que sale de la placa se recorta.
//  - Relieve "alto": el patrón sobresale de la placa (en la masa queda hundido).
//    Relieve "bajo": el patrón va grabado en la placa (en la masa queda en alto).
//  - Espejo: las letras van al revés en la placa para que en la masa se lean
//    al derecho (lo normal en un sello).
// Todo en milímetros, Y hacia arriba, calculado en el navegador.
import ClipperLib from "clipper-lib"

import { extruir } from "@/lib/generador/extruir"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { aplanar } from "@/lib/generador/llaveros"
import type { Dibujo, Malla, P, Trazo } from "@/lib/generador/vectores"

export type IconoTextura = "estrella" | "luna" | "corazon" | "flor" | "huella" | "circulo" | "rombo" | "copo"

export const ICONOS_TEXTURA: { id: IconoTextura; nombre: string; simbolo: string }[] = [
  { id: "estrella", nombre: "Estrella", simbolo: "★" },
  { id: "luna", nombre: "Luna", simbolo: "☾" },
  { id: "corazon", nombre: "Corazón", simbolo: "♥" },
  { id: "flor", nombre: "Flor", simbolo: "✿" },
  { id: "huella", nombre: "Huellita", simbolo: "🐾" },
  { id: "circulo", nombre: "Punto", simbolo: "●" },
  { id: "rombo", nombre: "Rombo", simbolo: "◆" },
  { id: "copo", nombre: "Copo", simbolo: "❄" },
]

export type OpcionesTexturizador = {
  palabras: string[] // cada una se repite en el patrón (vacío = sólo íconos)
  iconos: IconoTextura[]
  ancho: number // placa (mm)
  alto: number
  radio: number // esquinas de la placa
  tamano: number // alto de las letras y de los íconos (mm)
  espacioX: number // entre piezas en la fila
  espacioY: number // entre filas
  acomodo: "cuadricula" | "intercalado"
  orilla: number // franja lisa alrededor (0 = el patrón llega a la orilla)
  grosor: number // placa
  relieve: number // altura (o profundidad) del patrón
  modo: "alto" | "bajo"
  espejo: boolean
}

export type ResultadoTexturizador = {
  dibujo: Dibujo // CORTE (placa) + GRABADO (patrón)
  malla: Malla
  piezas: number // cuántas palabras/íconos caben (enteros o recortados)
  avisos: string[]
  errores: string[]
}

const ESC = 1000 // clipper usa enteros: 0.001 mm
const MAX_PIEZAS = 900
type CP = { X: number; Y: number }
const aClipper = (p: P[]): CP[] => p.map(([x, y]) => ({ X: Math.round(x * ESC), Y: Math.round(y * ESC) }))
const deClipper = (p: CP[]): P[] => p.map((q) => [q.X / ESC, q.Y / ESC])

function operar(tipo: number, sujeto: P[][], recorte: P[][]): P[][] {
  const c = new ClipperLib.Clipper()
  const s = sujeto.filter((p) => p.length >= 3).map(aClipper)
  const r = recorte.filter((p) => p.length >= 3).map(aClipper)
  if (!s.length) return []
  c.AddPaths(s, ClipperLib.PolyType.ptSubject, true)
  if (r.length) c.AddPaths(r, ClipperLib.PolyType.ptClip, true)
  const sol: CP[][] = []
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return sol.filter((p) => p.length >= 3).map(deClipper)
}
const unir = (a: P[][]) => operar(ClipperLib.ClipType.ctUnion, a, [])
const intersectar = (a: P[][], b: P[][]) => operar(ClipperLib.ClipType.ctIntersection, a, b)
const restar = (a: P[][], b: P[][]) => operar(ClipperLib.ClipType.ctDifference, a, b)

// ── Figuras (centradas en 0,0, de "1" de alto) ─────────────────────────────
const circ = (cx: number, cy: number, rx: number, ry = rx, n = 40): P[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P
  })

export function figura(icono: IconoTextura): P[][] {
  switch (icono) {
    case "estrella":
      return [Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 0.21 : 0.52
        const a = Math.PI / 2 + (i * Math.PI) / 5
        return [r * Math.cos(a), r * Math.sin(a) - 0.04] as P
      })]
    case "luna":
      return restar([circ(0, 0, 0.5)], [circ(0.24, 0.12, 0.42)])
    case "corazon": {
      const pts: P[] = []
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2
        pts.push([(16 * Math.sin(t) ** 3) / 34, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 34 + 0.05])
      }
      return [pts]
    }
    case "flor":
      return unir([...Array.from({ length: 5 }, (_, i) => {
        const a = Math.PI / 2 + (i * 2 * Math.PI) / 5
        return circ(0.27 * Math.cos(a), 0.27 * Math.sin(a), 0.2)
      }), circ(0, 0, 0.18)])
    case "huella":
      return [
        circ(0, -0.15, 0.24, 0.2),
        circ(-0.3, 0.13, 0.09, 0.12),
        circ(-0.11, 0.33, 0.09, 0.12),
        circ(0.11, 0.33, 0.09, 0.12),
        circ(0.3, 0.13, 0.09, 0.12),
      ]
    case "circulo":
      return [circ(0, 0, 0.3)]
    case "rombo":
      return [[[0, 0.5], [0.32, 0], [0, -0.5], [-0.32, 0]]]
    case "copo": {
      const brazos: P[][] = []
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3
        const c = Math.cos(a), s = Math.sin(a)
        const rect: P[] = [[-0.5, -0.05], [0.5, -0.05], [0.5, 0.05], [-0.5, 0.05]]
        brazos.push(rect.map(([x, y]) => [x * c - y * s, x * s + y * c]))
      }
      return unir(brazos)
    }
  }
}

type Pieza = { contornos: P[][]; ancho: number }

function piezaTexto(fuente: Fuente, palabra: string, tamano: number): Pieza | null {
  const t = textoACurvas(fuente, { texto: palabra, alto: tamano, espaciado: 0, interlineado: 1.4, alineacion: "centro" })
  const c = unir(t.curvas.map((k) => aplanar(k, Math.max(0.15, tamano / 60))).filter((p) => p.length >= 3))
  if (!c.length) return null
  const xs = c.flat().map((p) => p[0]), ys = c.flat().map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  return { contornos: c.map((p) => p.map(([x, y]) => [x - (x0 + x1) / 2, y - (y0 + y1) / 2] as P)), ancho: x1 - x0 }
}

function piezaIcono(icono: IconoTextura, tamano: number): Pieza {
  const c = figura(icono).map((p) => p.map(([x, y]) => [x * tamano, y * tamano] as P))
  const xs = c.flat().map((p) => p[0])
  return { contornos: c, ancho: Math.max(...xs) - Math.min(...xs) }
}

function rectRedondo(x0: number, y0: number, x1: number, y1: number, r: number): P[] {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2))
  if (rr < 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const pts: P[] = []
  const esq: [number, number, number][] = [[x1 - rr, y0 + rr, -Math.PI / 2], [x1 - rr, y1 - rr, 0], [x0 + rr, y1 - rr, Math.PI / 2], [x0 + rr, y0 + rr, Math.PI]]
  for (const [cx, cy, a0] of esq) for (let j = 0; j <= 8; j++) pts.push([cx + rr * Math.cos(a0 + (Math.PI / 2) * (j / 8)), cy + rr * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
  return pts
}

export function hacerTexturizador(fuente: Fuente | null, o: OpcionesTexturizador): ResultadoTexturizador {
  const avisos: string[] = []
  const vacio = (e: string): ResultadoTexturizador => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, malla: { tris: [], avisos: [] }, piezas: 0, avisos, errores: [e] })
  if (!(o.ancho >= 10 && o.alto >= 10)) return vacio("La placa debe medir al menos 10 × 10 mm.")
  if (o.ancho > 400 || o.alto > 400) return vacio("La placa es muy grande: el máximo es 400 × 400 mm (para algo más grande, divide en varias placas).")
  if (!(o.tamano >= 2)) return vacio("El tamaño de las letras e íconos debe ser de al menos 2 mm.")
  if (!(o.grosor > 0)) return vacio("Escribe el grosor de la placa.")
  if (!(o.relieve > 0)) return vacio("Escribe la altura del relieve.")
  if (o.modo === "bajo" && o.relieve >= o.grosor) return vacio("Grabado: la profundidad debe ser menor que el grosor de la placa.")

  const palabras = o.palabras.map((p) => p.trim()).filter(Boolean).slice(0, 6)
  if (palabras.length && !fuente) return vacio("Cargando la tipografía…")
  const piezas: Pieza[] = []
  for (const p of palabras) {
    const pz = piezaTexto(fuente!, p.slice(0, 20), o.tamano)
    if (pz) piezas.push(pz)
    else avisos.push(`La tipografía no tiene las letras de "${p}".`)
  }
  const iconos = o.iconos.map((i) => piezaIcono(i, o.tamano))
  // secuencia: palabra, ícono, palabra, ícono…
  const secuencia: Pieza[] = []
  const n = Math.max(piezas.length, iconos.length)
  for (let i = 0; i < n; i++) {
    if (piezas[i % Math.max(piezas.length, 1)] && piezas.length) secuencia.push(piezas[i % piezas.length])
    if (iconos.length) secuencia.push(iconos[i % iconos.length])
  }
  if (!secuencia.length) return vacio("Escribe una palabra o elige al menos un ícono.")

  // Filas: se llenan desde antes de la orilla hasta después, para que el recorte quede parejo
  const dx = Math.max(0, o.espacioX)
  const paso = o.tamano + Math.max(0, o.espacioY)
  const anchoSec = secuencia.reduce((a, p) => a + p.ancho + dx, 0)
  const elementos: P[][] = []
  let colocadas = 0
  const filas = Math.ceil(o.alto / paso) + 2
  for (let f = -1; f < filas && colocadas < MAX_PIEZAS; f++) {
    const y = f * paso + o.tamano / 2
    const corrida = o.acomodo === "intercalado" && f % 2 ? anchoSec / 2 : 0
    const inicio = o.acomodo === "intercalado" ? ((f % secuencia.length) + secuencia.length) % secuencia.length : 0
    let x = -corrida - (secuencia[inicio].ancho + dx)
    for (let k = 0; x < o.ancho + dx && colocadas < MAX_PIEZAS; k++) {
      const p = secuencia[(inicio + k) % secuencia.length]
      const cx = x + p.ancho / 2
      if (cx + p.ancho / 2 > -dx && cx - p.ancho / 2 < o.ancho + dx && y - o.tamano / 2 < o.alto + paso && y + o.tamano / 2 > -paso) {
        for (const c of p.contornos) elementos.push(c.map(([px, py]) => [cx + (o.espejo ? -px : px), y + py] as P))
        colocadas++
      }
      x += p.ancho + dx
    }
  }
  if (colocadas >= MAX_PIEZAS) avisos.push(`El patrón quedó limitado a ${MAX_PIEZAS} piezas: sube el tamaño o la separación.`)

  const placa = rectRedondo(0, 0, o.ancho, o.alto, o.radio)
  const m = Math.max(0, o.orilla)
  const zona = m > 0 ? rectRedondo(m, m, o.ancho - m, o.alto - m, Math.max(0, o.radio - m)) : placa
  if (m * 2 >= Math.min(o.ancho, o.alto)) return vacio("La orilla lisa es más grande que la placa.")
  const patron = intersectar(unir(elementos), [zona])
  if (!patron.length) return vacio("El patrón no cabe en la placa: baja el tamaño o la orilla.")

  const trazos: Trazo[] = [{ pts: placa, cerrado: true, capa: "CORTE" }, ...patron.map((pts) => ({ pts, cerrado: true, capa: "GRABADO" }))]
  const dibujo: Dibujo = { trazos, avisos: [], unidades: "mm" }
  const ext = (contornos: P[][], alto: number, z0: number) => {
    const r = extruir({ trazos: contornos.map((pts) => ({ pts, cerrado: true, capa: "X" })), avisos: [], unidades: "mm" }, { alto, base: 0, margenBase: 0, redondearBase: 0, espejo: false })
    const t = r.malla.tris
    if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0
    return t
  }
  let tris: number[]
  if (o.modo === "alto") {
    tris = [...ext([placa], o.grosor, 0), ...ext(patron, o.relieve, o.grosor)]
  } else {
    const base = o.grosor - o.relieve
    tris = [...ext([placa], base, 0), ...ext(restar([placa], patron), o.relieve, base)]
  }
  if (o.tamano < 6) avisos.push("Letras de menos de 6 mm pueden salir borrosas en una impresora FDM; en resina salen bien.")
  if (o.relieve < 0.6) avisos.push("Un relieve de menos de 0.6 mm casi no marca la masa: usa 0.8 a 1.5 mm.")
  return { dibujo, malla: { tris, avisos: [] }, piezas: colocadas, avisos, errores: [] }
}
