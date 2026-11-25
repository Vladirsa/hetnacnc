// Cortadores de galletas para imprimir en 3D (y su sello opcional).
//
// La forma sale de un ícono, de una figura clásica, de un nombre o de un
// dibujo SVG del cliente. Se junta en UN contorno (si viene en partes, como
// una huellita o las letras de un nombre, se "cierra": se engorda y se vuelve
// a adelgazar para que las partes queden unidas) y se escala a la medida.
//
// El cortador se imprime de cabeza: la ceja (el borde ancho para apoyar los
// dedos) sobre la cama y la pared hacia arriba. La pared va pegada por dentro
// al contorno, así la galleta sale de la medida; los últimos 2 mm son más
// delgados (el filo). Todo en milímetros, calculado en el navegador.
//
// El sello (opcional) es una placa que entra en el cortador con holgura y lleva
// un texto o un ícono en relieve, en espejo para que en la galleta se lea bien.
import ClipperLib from "clipper-lib"

import { extruir } from "@/lib/generador/extruir"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { aplanar } from "@/lib/generador/llaveros"
import { figura, type IconoTextura } from "@/lib/generador/texturizador"
import type { Dibujo, Malla, P, Trazo } from "@/lib/generador/vectores"

const ESC = 1000
type CP = { X: number; Y: number }
const aC = (p: P[]): CP[] => p.map(([x, y]) => ({ X: Math.round(x * ESC), Y: Math.round(y * ESC) }))
const deC = (p: CP[]): P[] => p.map((q) => [q.X / ESC, q.Y / ESC])

// Limpieza de puntos casi repetidos (en unidades de clipper, 1 = 0.001):
// mínima mientras las figuras están en escala 1 (si no, se comería las curvas
// de una nube o de un pino) y de 0.01 mm ya en milímetros (evita aristas
// sueltas en la malla del cortador).
const FINO = 1.5
const MM = 0.01 * ESC

function operar(tipo: number, a: P[][], b: P[][], limpiar = FINO): P[][] {
  const c = new ClipperLib.Clipper()
  c.StrictlySimple = true
  const s = a.filter((p) => p.length >= 3).map(aC)
  if (!s.length) return []
  c.AddPaths(s, ClipperLib.PolyType.ptSubject, true)
  const r = b.filter((p) => p.length >= 3).map(aC)
  if (r.length) c.AddPaths(r, ClipperLib.PolyType.ptClip, true)
  const sol: CP[][] = []
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  const limpio: CP[][] = (ClipperLib as any).Clipper.CleanPolygons(sol, limpiar)
  return limpio.filter((p) => p.length >= 3).map(deC)
}
const unir = (a: P[][], limpiar = FINO) => operar(ClipperLib.ClipType.ctUnion, a, [], limpiar)
const restar = (a: P[][], b: P[][], limpiar = FINO) => operar(ClipperLib.ClipType.ctDifference, a, b, limpiar)

/** Engorda (d > 0) o adelgaza (d < 0) los contornos, con esquinas redondas. */
export function desplazar(a: P[][], d: number, limpiar = FINO): P[][] {
  // precisión de las esquinas redondas: fina en escala 1, de 0.02 mm en milímetros
  const o = new ClipperLib.ClipperOffset(2, limpiar === FINO ? 0.25 : 0.02 * ESC)
  o.AddPaths(unir(a, limpiar).map(aC), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const sol: CP[][] = []
  o.Execute(sol, d * ESC)
  // fuera puntos casi repetidos (dejan aristas sueltas en la malla)
  const limpio: CP[][] = (ClipperLib as any).Clipper.CleanPolygons(sol, limpiar)
  return limpio.filter((p) => p.length >= 3).map(deC)
}

const area = (p: P[]) => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}
const caja = (a: P[][]) => {
  const pts = a.flat()
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}
const circ = (cx: number, cy: number, rx: number, ry = rx, n = 48): P[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P
  })
const poligono = (n: number, r: number, giro = Math.PI / 2): P[] => Array.from({ length: n }, (_, i) => [r * Math.cos(giro + (i * 2 * Math.PI) / n), r * Math.sin(giro + (i * 2 * Math.PI) / n)] as P)

// ── Formas ───────────────────────────────────────────────────────────────
export type FormaClasica = "redondo" | "ovalo" | "cuadrado" | "hexagono" | "nube" | "arbol" | "casa" | "gota"
export type FormaCortador = { tipo: "icono"; icono: IconoTextura } | { tipo: "clasica"; forma: FormaClasica } | { tipo: "nombre"; texto: string } | { tipo: "svg"; dibujo: Dibujo }

export const FORMAS_CLASICAS: { id: FormaClasica; nombre: string }[] = [
  { id: "redondo", nombre: "Redondo" },
  { id: "ovalo", nombre: "Óvalo" },
  { id: "cuadrado", nombre: "Cuadrado" },
  { id: "hexagono", nombre: "Hexágono" },
  { id: "nube", nombre: "Nube" },
  { id: "arbol", nombre: "Pino" },
  { id: "casa", nombre: "Casita" },
  { id: "gota", nombre: "Gota" },
]

function clasica(f: FormaClasica): P[][] {
  switch (f) {
    case "redondo":
      return [circ(0, 0, 0.5)]
    case "ovalo":
      return [circ(0, 0, 0.5, 0.34)]
    case "cuadrado":
      return desplazar([[[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]]], 0.08)
    case "hexagono":
      return [poligono(6, 0.5, 0)]
    case "nube":
      // tres bultos arriba y la base plana, con las esquinas de abajo redondeadas
      return desplazar(unir([circ(-0.28, -0.04, 0.19), circ(-0.04, 0.1, 0.26), circ(0.25, 0.01, 0.21), [[-0.43, -0.23], [0.42, -0.23], [0.42, -0.03], [-0.43, -0.03]]]), 0.02)
    case "arbol":
      return desplazar(
        unir([
          [[-0.42, -0.25], [0.42, -0.25], [0, 0.12]],
          [[-0.33, -0.02], [0.33, -0.02], [0, 0.32]],
          [[-0.24, 0.2], [0.24, 0.2], [0, 0.5]],
          [[-0.08, -0.5], [0.08, -0.5], [0.08, -0.24], [-0.08, -0.24]],
        ]),
        0.02
      )
    case "casa":
      return desplazar([[[-0.36, -0.45], [0.36, -0.45], [0.36, 0.08], [0.46, 0.08], [0, 0.48], [-0.46, 0.08], [-0.36, 0.08]]], 0.03)
    case "gota": {
      const pts: P[] = []
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2
        pts.push([0.36 * Math.sin(t) * Math.sin(t / 2) ** 1.2, 0.5 * Math.cos(t)])
      }
      return [pts]
    }
  }
}

export class ErrorCortador extends Error {}

/** Contornos de la forma (sin escalar), antes de juntarla en uno solo. */
function contornos(forma: FormaCortador, fuente: Fuente | null): P[][] {
  if (forma.tipo === "icono") return figura(forma.icono)
  if (forma.tipo === "clasica") return clasica(forma.forma)
  if (forma.tipo === "nombre") {
    const texto = forma.texto.trim().slice(0, 14)
    if (!texto) throw new ErrorCortador("Escribe el nombre.")
    if (!fuente) throw new ErrorCortador("Cargando la tipografía…")
    const t = textoACurvas(fuente, { texto, alto: 10, espaciado: 0, interlineado: 1.3, alineacion: "centro" })
    const c = unir(t.curvas.map((k) => aplanar(k, 0.12)).filter((p) => p.length >= 3))
    if (!c.length) throw new ErrorCortador("La tipografía no tiene esas letras.")
    return c
  }
  // dibujo del cliente: sólo los trazos cerrados
  const cerrados = forma.dibujo.trazos.filter((t) => t.cerrado && t.pts.length >= 3).map((t) => t.pts)
  if (!cerrados.length) throw new ErrorCortador("El dibujo no tiene contornos cerrados. Usa un SVG con la silueta cerrada.")
  // y con Y hacia arriba (el SVG la trae hacia abajo)
  return unir(cerrados.map((p) => p.map(([x, y]) => [x, -y] as P)))
}

/**
 * Un solo contorno, escalado para que su lado más largo mida `tamano` mm.
 * Si la forma viene en partes, se cierran los huecos entre ellas.
 */
export function silueta(forma: FormaCortador, fuente: Fuente | null, tamano: number): { contorno: P[]; avisos: string[] } {
  const avisos: string[] = []
  let c = contornos(forma, fuente)
  // a la medida
  let b = caja(c)
  let k = tamano / Math.max(b.x1 - b.x0, b.y1 - b.y0)
  c = c.map((p) => p.map(([x, y]) => [(x - (b.x0 + b.x1) / 2) * k, (y - (b.y0 + b.y1) / 2) * k] as P))
  // sólo la silueta de afuera (los huecos de adentro no se cortan)
  const afuera = (a: P[][]) => a.filter((p) => area(p) > 0)
  let partes = afuera(unir(c, MM))
  if (partes.length > 1) {
    // se cierran los espacios entre partes: engordar y adelgazar lo mismo
    for (const r of [tamano * 0.04, tamano * 0.07, tamano * 0.11]) {
      partes = afuera(desplazar(desplazar(partes, r, MM), -r, MM))
      if (partes.length <= 1) break
    }
    if (partes.length > 1) {
      // si siguen separadas, se queda la parte más grande
      partes = [partes.sort((a, b2) => area(b2) - area(a))[0]]
      avisos.push("La forma tenía partes separadas: se usó la más grande. Para unirlas, junta las piezas en tu dibujo.")
    } else avisos.push("Las partes de la forma se unieron en una sola silueta para que se pueda cortar.")
  }
  if (!partes.length) throw new ErrorCortador("No salió una silueta: revisa la forma.")
  // tras cerrar puede crecer un poco: se vuelve a la medida
  b = caja(partes)
  k = tamano / Math.max(b.x1 - b.x0, b.y1 - b.y0)
  const contorno = partes[0].map(([x, y]) => [(x - (b.x0 + b.x1) / 2) * k, (y - (b.y0 + b.y1) / 2) * k] as P)
  return { contorno, avisos }
}

// ── Mallas ───────────────────────────────────────────────────────────────
function extruirContornos(cs: P[][], alto: number, z0 = 0): number[] {
  const r = extruir({ trazos: cs.map((pts) => ({ pts, cerrado: true, capa: "X" })), avisos: [], unidades: "mm" }, { alto, base: 0, margenBase: 0, redondearBase: 0, espejo: false })
  const t = r.malla.tris
  if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0
  return t
}

export type OpcionesCortador = {
  tamano: number // lado más largo de la galleta (mm)
  altura: number // altura total del cortador (mm)
  pared: number // grosor de la pared (mm)
  ceja: number // ancho de la ceja hacia afuera (mm)
  grosorCeja: number // (mm)
  sello: { tipo: "ninguno" } | { tipo: "texto"; texto: string } | { tipo: "icono"; icono: IconoTextura }
  relieveSello: number // (mm)
}

export type ResultadoCortador = {
  contorno: P[] // la galleta (mm)
  dibujo: Dibujo // contorno de la galleta + sello
  cortador: Malla
  sello: Malla | null
  ancho: number
  alto: number
  avisos: string[]
  errores: string[]
}

const FILO = 2 // mm de pared delgada arriba
const HOLGURA_SELLO = 0.8 // mm entre el sello y la pared

export function hacerCortador(forma: FormaCortador, fuente: Fuente | null, o: OpcionesCortador): ResultadoCortador {
  const vacio = (e: string): ResultadoCortador => ({ contorno: [], dibujo: { trazos: [], avisos: [], unidades: "mm" }, cortador: { tris: [], avisos: [] }, sello: null, ancho: 0, alto: 0, avisos: [], errores: [e] })
  if (!(o.tamano >= 20 && o.tamano <= 200)) return vacio("La galleta debe medir entre 20 y 200 mm.")
  if (!(o.altura >= 6 && o.altura <= 40)) return vacio("La altura del cortador va de 6 a 40 mm.")
  if (!(o.pared >= 0.6 && o.pared <= 4)) return vacio("La pared va de 0.6 a 4 mm (con boquilla de 0.4 mm: 0.8 o 1.2).")
  if (!(o.ceja >= 0 && o.ceja <= 10)) return vacio("La ceja va de 0 a 10 mm.")
  if (o.ceja > 0 && !(o.grosorCeja >= 0.8 && o.grosorCeja < o.altura - FILO)) return vacio("El grosor de la ceja debe ser de al menos 0.8 mm y menor que la altura.")
  let base: { contorno: P[]; avisos: string[] }
  try {
    base = silueta(forma, fuente, o.tamano)
  } catch (e) {
    return vacio(e instanceof Error ? e.message : "No salió la forma.")
  }
  const avisos = [...base.avisos]
  const forma0 = [base.contorno]

  // pared: anillo pegado por dentro al contorno; los últimos FILO mm, más delgada
  const filo = Math.max(0.4, o.pared / 2)
  const pared = restar(desplazar(forma0, o.pared, MM), forma0, MM)
  const punta = restar(desplazar(forma0, filo, MM), forma0, MM)
  const tris: number[] = [...extruirContornos(pared, o.altura - FILO), ...extruirContornos(punta, FILO + 0.01, o.altura - FILO - 0.01)]
  if (o.ceja > 0) tris.push(...extruirContornos(restar(desplazar(forma0, o.pared + o.ceja, MM), forma0, MM), o.grosorCeja))

  // partes demasiado angostas: la pared se encima consigo misma
  const angosta = desplazar(forma0, -o.pared * 1.5, MM)
  if (!angosta.length || caja(angosta).x1 - caja(angosta).x0 < o.pared) avisos.push("La forma es muy angosta para esta pared: súbele el tamaño.")
  if (o.altura - FILO < 6) avisos.push("Un cortador de menos de 8 mm de alto no corta masas gruesas.")

  const trazos: Trazo[] = [{ pts: base.contorno, cerrado: true, capa: "CORTE" }]
  // sello
  let sello: Malla | null = null
  if (o.sello.tipo !== "ninguno") {
    const placa = desplazar(forma0, -HOLGURA_SELLO, MM)
    if (!placa.length) avisos.push("La galleta es muy chica para el sello.")
    else {
      const bp = caja(placa)
      const libre = Math.min(bp.x1 - bp.x0, bp.y1 - bp.y0) * 0.62
      let dibujo: P[][] = []
      if (o.sello.tipo === "icono") dibujo = figura(o.sello.icono)
      else if (fuente && o.sello.texto.trim()) {
        const t = textoACurvas(fuente, { texto: o.sello.texto.trim().slice(0, 24), alto: 10, espaciado: 0, interlineado: 1.3, alineacion: "centro" })
        dibujo = unir(t.curvas.map((k) => aplanar(k, 0.12)).filter((p) => p.length >= 3), MM)
      } else if (!fuente) avisos.push("Cargando la tipografía del sello…")
      if (dibujo.length) {
        const bd = caja(dibujo)
        const kd = libre / Math.max(bd.x1 - bd.x0, bd.y1 - bd.y0)
        // centrado y en espejo (para que en la galleta se lea al derecho)
        const cx = (bp.x0 + bp.x1) / 2, cy = (bp.y0 + bp.y1) / 2
        const det = operar(ClipperLib.ClipType.ctIntersection, dibujo.map((p) => p.map(([x, y]) => [cx - (x - (bd.x0 + bd.x1) / 2) * kd, cy + (y - (bd.y0 + bd.y1) / 2) * kd] as P)), desplazar(placa, -1, MM), MM)
        const GROSOR = 3
        // el sello se dibuja al lado del cortador en la vista y en el STL
        const dx = o.tamano + o.pared * 2 + o.ceja * 2 + 10
        const mover = (cs: P[][]) => cs.map((p) => p.map(([x, y]) => [x + dx, y] as P))
        sello = { tris: [...extruirContornos(mover(placa), GROSOR), ...extruirContornos(mover(det), o.relieveSello, GROSOR)], avisos: [] }
        trazos.push(...det.map((pts) => ({ pts, cerrado: true, capa: "GRABADO" })))
        if (o.sello.tipo === "texto" && kd * 10 < 5) avisos.push("El texto del sello queda de menos de 5 mm: usa menos letras o una galleta más grande.")
      }
    }
  }
  const b = caja([base.contorno])
  return {
    contorno: base.contorno,
    dibujo: { trazos, avisos: [], unidades: "mm" },
    cortador: { tris, avisos: [] },
    sello,
    ancho: b.x1 - b.x0,
    alto: b.y1 - b.y0,
    avisos,
    errores: [],
  }
}
