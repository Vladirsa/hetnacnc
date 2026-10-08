// Patrones radiales generativos (mandalas, arte de pared, posavasos) para corte
// láser: varias capas de una misma figura, cada una escalada y rotada según una
// fórmula matemática que el usuario escribe (p. ej. "10*sin(i/2)"). Basado en la
// idea de "Rad Lines" (github.com/msurguy/rad-lines), reimplementado nativo en
// TypeScript -ese proyecto es Vue, no se integra a este stack- con curvas propias
// (spline de Catmull-Rom) en vez de d3-shape, para no agregar otra dependencia.
import { create, all } from "mathjs"

const math = create(all)

export type Punto = [number, number]
export type FormaPatron = "poligono" | "organico"

export type OpcionesPatron = {
  forma: FormaPatron
  lados: number // solo "poligono": número de lados, 3–24
  capas: number // cuántas curvas apiladas (1–60)
  radioMin: number // mm, radio de la capa i=0
  radioMax: number // mm, techo del radio aleatorio ("organico") o referencia
  anguloMin: number // grados, inicio del arco (360 = figura cerrada completa)
  anguloMax: number // grados
  formulaEscala: string // fórmula en términos de i (capa 0..capas-1): cuánto crece el radio
  formulaRotacion: string // fórmula en términos de i: grados de rotación extra
  redondeo: number // 0 = polígono anguloso, 1 = curva muy suave (orgánica)
  semilla: number // solo "organico": hace reproducible el azar
}

export type ResultadoPatron = {
  capas: Punto[][] // una curva cerrada (ya suavizada y muestreada) por capa, en mm
  errores: string[]
}

// generador pseudoaleatorio determinista (mulberry32): misma semilla -> mismo patrón
function creaAleatorio(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const gradAr = (g: number) => (g * Math.PI) / 180

// puntos base de un polígono regular (o arco de polígono), centrado en (0,0), radio 1
function poligonoBase(lados: number, anguloMin: number, anguloMax: number): Punto[] {
  const pts: Punto[] = []
  const cerrado = anguloMax - anguloMin >= 359.999
  const n = Math.max(3, Math.round(lados))
  for (let i = 0; i < n; i++) {
    if (!cerrado && i === n) break
    const t = anguloMin + ((anguloMax - anguloMin) * i) / (cerrado ? n : n - 1)
    pts.push([Math.sin(gradAr(t)), Math.cos(gradAr(t))])
  }
  return pts
}

// puntos base "orgánicos": radio aleatorio por sector angular, mismo contorno para
// todas las capas (solo cambia el escalado/rotación por fórmula) - así las capas
// anidadas se ven como anillos de una misma silueta irregular, no ruido distinto cada vez.
function organicoBase(lados: number, semilla: number, anguloMin: number, anguloMax: number): Punto[] {
  const azar = creaAleatorio(semilla)
  const n = Math.max(3, Math.round(lados))
  const cerrado = anguloMax - anguloMin >= 359.999
  const radios: number[] = []
  for (let i = 0; i < n; i++) radios.push(0.55 + azar() * 0.45)
  if (cerrado) radios.push(radios[0])
  const pts: Punto[] = []
  const pasos = cerrado ? n : n - 1
  for (let i = 0; i <= pasos; i++) {
    const t = anguloMin + ((anguloMax - anguloMin) * i) / pasos
    const r = radios[i % radios.length]
    pts.push([r * Math.sin(gradAr(t)), r * Math.cos(gradAr(t))])
  }
  return pts
}

// Catmull-Rom cerrado: muestrea `pasos` puntos intermedios entre cada par de
// vértices. redondeo=0 deja los vértices originales (polígono recto);
// redondeo=1 usa la curva completa.
function suavizarCerrado(pts: Punto[], redondeo: number, pasos = 10): Punto[] {
  if (redondeo <= 0 || pts.length < 3) return pts
  const n = pts.length
  const r = Math.max(0, Math.min(1, redondeo))
  const out: Punto[] = []
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    for (let k = 0; k < pasos; k++) {
      const t = k / pasos
      const t2 = t * t
      const t3 = t2 * t
      const cx =
        0.5 *
        (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const cy =
        0.5 *
        (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      // lineal <-> catmull-rom según redondeo, para poder "apenas" suavizar
      const lx = p1[0] + (p2[0] - p1[0]) * t
      const ly = p1[1] + (p2[1] - p1[1]) * t
      out.push([lx + (cx - lx) * r, ly + (cy - ly) * r])
    }
  }
  return out
}

function evaluarFormula(formula: string, i: number, porDefecto: number): number {
  try {
    const v = math.evaluate(formula, { i })
    return typeof v === "number" && Number.isFinite(v) ? v : porDefecto
  } catch {
    return porDefecto
  }
}

export function generarPatron(o: OpcionesPatron): ResultadoPatron {
  const errores: string[] = []
  if (o.capas < 1 || o.capas > 80) errores.push("El número de capas debe ser entre 1 y 80.")
  if (o.radioMax <= 0) errores.push("El radio debe ser mayor que cero.")
  if (o.lados < 3 || o.lados > 24) errores.push("El número de lados debe ser entre 3 y 24.")
  if (errores.length) return { capas: [], errores }

  const base =
    o.forma === "poligono" ? poligonoBase(o.lados, o.anguloMin, o.anguloMax) : organicoBase(o.lados, o.semilla, o.anguloMin, o.anguloMax)

  const capas: Punto[][] = []
  for (let i = 0; i < o.capas; i++) {
    const escala = o.radioMin + evaluarFormula(o.formulaEscala, i, 0)
    const rotacion = evaluarFormula(o.formulaRotacion, i, 0)
    const cosR = Math.cos(gradAr(rotacion))
    const sinR = Math.sin(gradAr(rotacion))
    const transformado: Punto[] = base.map(([x, y]) => {
      const sx = x * escala
      const sy = y * escala
      return [sx * cosR - sy * sinR, sx * sinR + sy * cosR]
    })
    capas.push(suavizarCerrado(transformado, o.redondeo))
  }
  return { capas, errores }
}

// Caja que contiene todas las capas, para centrar/medir la pieza (mm)
export function cajaPatron(capas: Punto[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const capa of capas) {
    for (const [x, y] of capa) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return { ancho: 0, alto: 0, minX: 0, minY: 0 }
  return { ancho: maxX - minX, alto: maxY - minY, minX, minY }
}

const f = (x: number) => String(Math.round(x * 1000) / 1000)

// SVG en milímetros, una capa = un <path> cerrado
export function patronASVG(capas: Punto[][], modo: "corte" | "vista" = "corte"): string {
  const { ancho, alto, minX, minY } = cajaPatron(capas)
  const m = 2
  const W = ancho + 2 * m
  const H = alto + 2 * m
  const trazo =
    modo === "vista"
      ? `fill="none" stroke="#C2560A" stroke-width="0.6" vector-effect="non-scaling-stroke"`
      : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const cuerpos = capas
    .map((capa) => {
      const d = capa.map(([x, y], i) => `${i ? "L" : "M"}${f(m + x - minX)} ${f(m + alto - (y - minY))}`).join(" ") + " Z"
      return `<path d="${d}" ${trazo}/>`
    })
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpos}\n</svg>\n`
}

// DXF R12, una POLYLINE cerrada por capa, capa "CORTE", unidades mm
export function patronADXF(capas: Punto[][]): string {
  const { minX, minY } = cajaPatron(capas)
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER")
  par(9, "$ACADVER"); par(1, "AC1009")
  par(9, "$INSUNITS"); par(70, 4)
  par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  for (const capa of capas) {
    par(0, "POLYLINE"); par(8, "CORTE"); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
    for (const [x, y] of capa) {
      par(0, "VERTEX"); par(8, "CORTE"); par(10, f(x - minX)); par(20, f(y - minY)); par(30, 0)
    }
    par(0, "SEQEND"); par(8, "CORTE")
  }
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}
