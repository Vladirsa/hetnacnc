// Placas para imprimir en 3D (módulo "Llaveros y placas" del 3D Studio):
//  · Etiquetas en braille: el texto en braille español (signo de mayúscula ⠨,
//    signo de número ⠼, acentos y ñ) con los puntos en relieve a la medida
//    estándar, y si se quiere el texto visible arriba para quien ve.
//  · Etiquetas para cajas organizadoras: placa de la medida que pongas (36×11
//    mm para Gridfinity) con el texto ajustado y un ícono opcional.
// Las dos salen con partes (placa / relieve) para imprimirse a dos colores.
import { cajaDe, circuloPts, extruirEn, moverC as mover, rectRedondo } from "@/lib/generador/contornos"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { aplanar } from "@/lib/generador/llaveros"
import { figura, type IconoTextura } from "@/lib/generador/texturizador"
import { unirContornos } from "@/lib/generador/unirContornos"
import { type Dibujo, type Malla, type P, type Trazo, conPartes } from "@/lib/generador/vectores"

/** Texto a contornos unidos, con su caja (en mm, alto de la H = alto). */
function textoContornos(fuente: Fuente, texto: string, alto: number): P[][] {
  const t = textoACurvas(fuente, { texto, alto, espaciado: 0, interlineado: 1.3, alineacion: "centro" })
  const c = t.curvas.map((x) => aplanar(x)).filter((p) => p.length >= 3)
  return c.length ? unirContornos(c) : []
}

// ── Braille ────────────────────────────────────────────────────────────────
// Puntos de cada celda (1-2-3 columna izquierda de arriba abajo, 4-5-6 derecha)
const LETRAS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6], ñ: [1, 2, 4, 5, 6],
  á: [1, 2, 3, 5, 6], é: [2, 3, 4, 6], í: [3, 4], ó: [3, 4, 6], ú: [2, 3, 4, 5, 6], ü: [1, 2, 5, 6],
  ".": [3], ",": [2], ";": [2, 3], ":": [2, 5], "?": [2, 6], "¿": [2, 6], "!": [2, 3, 5], "¡": [2, 3, 5], "-": [3, 6], "(": [1, 2, 6], ")": [3, 4, 5], '"': [2, 3, 6], "/": [3, 4],
}
const DIGITO = "jabcdefghi" // 0-9 usan las letras a-j tras el signo de número
const SIGNO_NUMERO = [3, 4, 5, 6]
const SIGNO_MAYUSCULA = [4, 6]

/** Texto → celdas braille (cada celda, sus puntos; [] es un espacio). Lo que no tiene braille se reporta. */
export function aBraille(texto: string): { celdas: number[][]; sinBraille: string[] } {
  const celdas: number[][] = []
  const sinBraille: string[] = []
  let enNumero = false
  for (const ch of texto.normalize("NFC")) {
    if (/\s/.test(ch)) {
      celdas.push([])
      enNumero = false
      continue
    }
    if (/[0-9]/.test(ch)) {
      if (!enNumero) celdas.push(SIGNO_NUMERO)
      enNumero = true
      celdas.push(LETRAS[DIGITO[Number(ch)]])
      continue
    }
    const min = ch.toLowerCase()
    const puntos = LETRAS[min]
    if (!puntos) {
      if (!sinBraille.includes(ch)) sinBraille.push(ch)
      continue
    }
    // una letra de la a a la j justo después de un número se confundiría con un dígito
    if (enNumero && /[a-j]/.test(min)) celdas.push([5, 6])
    enNumero = false
    if (ch !== min) celdas.push(SIGNO_MAYUSCULA)
    celdas.push(puntos)
  }
  return { celdas, sinBraille }
}

/** Cúpula (casquete esférico) cerrada: el punto de braille. */
function cupula(cx: number, cy: number, d: number, h: number, z0: number): number[] {
  const R = (d * d) / 4 / (2 * h) + h / 2 // radio de la esfera que da ese casquete
  const zc = z0 + h - R
  const anillos = 4, lados = 16
  const anillo = (j: number): [number, number, number][] => {
    const z = z0 + (h * j) / anillos
    const r = j >= anillos ? 0 : Math.sqrt(Math.max(0, R * R - (z - zc) * (z - zc)))
    return Array.from({ length: lados }, (_, i) => [cx + r * Math.cos((i / lados) * 2 * Math.PI), cy + r * Math.sin((i / lados) * 2 * Math.PI), z])
  }
  const t: number[] = []
  const tri = (a: number[], b: number[], c: number[]) => t.push(...a, ...b, ...c)
  const base = anillo(0)
  for (let i = 1; i + 1 < lados; i++) tri(base[0], base[i + 1], base[i]) // piso, mirando hacia abajo
  for (let j = 0; j < anillos; j++) {
    const a = anillo(j), b = anillo(j + 1)
    for (let i = 0; i < lados; i++) {
      const i2 = (i + 1) % lados
      if (j + 1 < anillos) {
        tri(a[i], a[i2], b[i2])
        tri(a[i], b[i2], b[i])
      } else tri(a[i], a[i2], b[0]) // la punta
    }
  }
  return t
}

export type OpcionesBraille = {
  texto: string // un renglón por línea
  textoVisible: boolean // el texto en letras arriba, para quien ve
  punto: number // diámetro del punto (estándar 1.5; impreso suele ir 1.6)
  altoPunto: number // (estándar 0.5–0.6)
  grosor: number // placa
  barrenos: boolean // dos barrenos para atornillar a la pared o puerta
}
export const OPCIONES_BRAILLE_FABRICA: Omit<OpcionesBraille, "texto"> = { textoVisible: true, punto: 1.6, altoPunto: 0.6, grosor: 2, barrenos: false }
const PASO_PUNTO = 2.5, PASO_CELDA = 6, PASO_RENGLON = 10, MARGEN = 5, MAX_CELDAS = 40, MAX_RENGLONES = 6

export type ResultadoPlaca = { malla: Malla; dibujo: Dibujo; ancho: number; alto: number; avisos: string[]; errores: string[] }

export function hacerBraille(fuente: Fuente | null, o: OpcionesBraille): ResultadoPlaca {
  const vacio = (e: string): ResultadoPlaca => ({ malla: { tris: [], avisos: [] }, dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: [e] })
  const renglones = o.texto.replace(/\r/g, "").split("\n").map((r) => r.trim()).filter(Boolean).slice(0, MAX_RENGLONES)
  if (!renglones.length) return vacio("Escribe el texto de la etiqueta.")
  const avisos: string[] = []
  const lineas = renglones.map((r) => aBraille(r))
  const raros = [...new Set(lineas.flatMap((l) => l.sinBraille))]
  if (raros.length) avisos.push(`Sin braille (se omiten): ${raros.join(" ")}`)
  const largo = Math.max(...lineas.map((l) => l.celdas.length))
  if (!largo) return vacio("Ese texto no tiene letras en braille.")
  if (largo > MAX_CELDAS) return vacio(`Cada renglón puede tener hasta ${MAX_CELDAS} celdas de braille (este lleva ${largo}).`)

  // texto visible arriba (alto 6 mm por renglón)
  const ALTO_LETRA = 6
  let visible: P[][] = []
  if (o.textoVisible && fuente) {
    const t = textoContornos(fuente, renglones.join("\n"), ALTO_LETRA)
    if (t.length) visible = t
  } else if (o.textoVisible && !fuente) avisos.push("Cargando la tipografía…")
  const bv = visible.length ? cajaDe(visible) : null

  const anchoBraille = largo * PASO_CELDA - (PASO_CELDA - PASO_PUNTO) + o.punto
  const altoBraille = lineas.length * PASO_RENGLON - (PASO_RENGLON - 2 * PASO_PUNTO) + o.punto
  const anchoVisible = bv ? bv.x1 - bv.x0 : 0
  const altoVisible = bv ? bv.y1 - bv.y0 + 4 : 0
  const extraBarreno = o.barrenos ? 10 : 0
  const W = Math.max(anchoBraille, anchoVisible) + 2 * MARGEN + 2 * extraBarreno
  const H = altoBraille + altoVisible + 2 * MARGEN

  // placa (con barrenos opcionales a los lados)
  const placa = rectRedondo(0, 0, W, H, 3)
  const hoyos = o.barrenos ? [circuloPts(MARGEN + 2, H / 2, 2.1), circuloPts(W - MARGEN - 2, H / 2, 2.1)] : []
  const trisPlaca = extruirEn([placa, ...hoyos], o.grosor)

  // puntos: de arriba hacia abajo, debajo del texto visible
  const puntos: number[] = []
  const x0 = (W - anchoBraille) / 2 + o.punto / 2
  const yTop = H - MARGEN - altoVisible - o.punto / 2
  lineas.forEach((l, r) => {
    l.celdas.forEach((celda, c) => {
      for (const p of celda) {
        const col = p <= 3 ? 0 : 1, fila = (p - 1) % 3
        puntos.push(...cupula(x0 + c * PASO_CELDA + col * PASO_PUNTO, yTop - r * PASO_RENGLON - fila * PASO_PUNTO, o.punto, o.altoPunto, o.grosor - 0.01))
      }
    })
  })
  const letras = bv ? extruirEn(mover(visible, W / 2 - (bv.x0 + bv.x1) / 2, H - MARGEN - bv.y1), 0.8, o.grosor - 0.01) : []
  const malla = conPartes(["Placa", trisPlaca], ["Braille y letras", [...puntos, ...letras]])
  if (o.punto < 1.4 || o.altoPunto < 0.5) avisos.push("Puntos más chicos que el estándar: pueden costar trabajo leerse con el dedo.")
  const trazos: Trazo[] = [{ pts: placa, cerrado: true, capa: "CORTE" }, ...hoyos.map((pts) => ({ pts, cerrado: true, capa: "CORTE" }))]
  return { malla, dibujo: { trazos, avisos: [], unidades: "mm" }, ancho: W, alto: H, avisos, errores: [] }
}

// ── Etiquetas para cajas ───────────────────────────────────────────────────
export type OpcionesEtiqueta = {
  texto: string
  ancho: number
  alto: number
  grosor: number
  relieve: number
  icono: IconoTextura | ""
  radio: number
}
export const OPCIONES_ETIQUETA_FABRICA: Omit<OpcionesEtiqueta, "texto"> = { ancho: 36, alto: 11, grosor: 1.2, relieve: 0.6, icono: "", radio: 1 }
export const MEDIDAS_ETIQUETA: { id: string; nombre: string; ancho: number; alto: number }[] = [
  { id: "gridfinity", nombre: "Gridfinity (36 × 11)", ancho: 36, alto: 11 },
  { id: "chica", nombre: "Chica (50 × 15)", ancho: 50, alto: 15 },
  { id: "mediana", nombre: "Mediana (70 × 20)", ancho: 70, alto: 20 },
  { id: "grande", nombre: "Grande (100 × 30)", ancho: 100, alto: 30 },
]

export function hacerEtiqueta(fuente: Fuente, o: OpcionesEtiqueta): ResultadoPlaca {
  const vacio = (e: string): ResultadoPlaca => ({ malla: { tris: [], avisos: [] }, dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: [e] })
  const texto = o.texto.replace(/\r/g, "").split("\n").slice(0, 2).join("\n").trim()
  if (!texto && !o.icono) return vacio("Escribe el texto de la etiqueta.")
  if (!(o.ancho >= 10 && o.alto >= 5)) return vacio("La etiqueta es muy chica (mínimo 10 × 5 mm).")
  const avisos: string[] = []
  const m = Math.min(1.5, o.alto * 0.12)
  // el ícono (si hay) a la izquierda, del alto útil
  const util = o.alto - 2 * m
  let ico: P[][] = []
  if (o.icono) {
    const f = unirContornos(figura(o.icono))
    const b = cajaDe(f)
    const k = util / Math.max(1e-6, Math.max(b.x1 - b.x0, b.y1 - b.y0))
    ico = mover(f, m - b.x0 * k, o.alto / 2 - ((b.y0 + b.y1) / 2) * k, k)
  }
  const xTexto = ico.length ? m + util + m : m
  const anchoTexto = o.ancho - xTexto - m
  let letras: P[][] = []
  if (texto) {
    const t = textoContornos(fuente, texto, 10)
    if (t.length) {
      const b = cajaDe(t)
      // al tamaño que quepa en el espacio libre (ancho y alto)
      const k = Math.min(anchoTexto / Math.max(1e-6, b.x1 - b.x0), util / Math.max(1e-6, b.y1 - b.y0))
      letras = mover(t, xTexto + anchoTexto / 2 - ((b.x0 + b.x1) / 2) * k, o.alto / 2 - ((b.y0 + b.y1) / 2) * k, k)
      if (10 * k < 2.5) avisos.push("El texto queda de menos de 2.5 mm de alto: usa menos letras o una etiqueta más grande.")
    }
  }
  const placa = rectRedondo(0, 0, o.ancho, o.alto, o.radio)
  const relieve = [...ico, ...letras]
  const malla = conPartes(["Placa", extruirEn([placa], o.grosor)], ["Texto e ícono", extruirEn(relieve, o.relieve, o.grosor - 0.01)])
  const trazos: Trazo[] = [{ pts: placa, cerrado: true, capa: "CORTE" }, ...relieve.map((pts) => ({ pts, cerrado: true, capa: "GRABADO" }))]
  return { malla, dibujo: { trazos, avisos: [], unidades: "mm" }, ancho: o.ancho, alto: o.alto, avisos, errores: [] }
}
