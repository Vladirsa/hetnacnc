// Generador de caja con juntas de dedo (finger joints) para láser y router CNC.
// Todo se calcula en milímetros y en el navegador: no usa servidor ni IA.
//
// Cómo encajan las piezas:
//  - Frente y atrás: todos sus bordes son tipo A (dedo afuera en las esquinas).
//  - Laterales: borde de abajo/arriba tipo A; bordes verticales tipo B.
//  - Base y tapa: todos sus bordes tipo B (hueco en las esquinas).
// Cada borde tipo A encaja con uno tipo B del mismo largo y mismo número de dedos.

export type Punto = [number, number]

export type OpcionesCaja = {
  ancho: number // eje X, mm
  fondo: number // eje Y, mm
  alto: number // eje Z, mm
  espesor: number // espesor del material, mm
  dedo: number // ancho deseado de cada dedo, mm
  kerf: number // grosor del corte (láser ~0.1-0.2 mm; router: 0), mm
  medidas: "exteriores" | "interiores"
  tapa: boolean
}

export type Pieza = {
  nombre: string
  ancho: number
  alto: number
  contorno: Punto[] // polígono cerrado, en mm, con la esquina inferior izquierda en (0,0)
}

export type ResultadoCaja = {
  piezas: Pieza[]
  errores: string[]
  avisos: string[]
  exterior: { ancho: number; fondo: number; alto: number }
  interior: { ancho: number; fondo: number; alto: number }
  dedos: { ancho: number; fondo: number; alto: number } // número de segmentos por lado
}

type TipoBorde = "A" | "B" | "L" // L = liso (sin dedos)

// número impar de segmentos, lo más cercano al ancho de dedo pedido, mínimo 3
const segmentos = (largo: number, dedo: number) => {
  const r = largo / dedo
  let n = Math.round(r)
  if (n % 2 === 0) n = Math.abs(n + 1 - r) <= Math.abs(n - 1 - r) ? n + 1 : n - 1
  return Math.max(3, n)
}

// profundidad hacia adentro del segmento i
const profundidad = (tipo: TipoBorde, i: number, t: number) => {
  if (tipo === "L") return 0
  const afuera = tipo === "A" ? i % 2 === 0 : i % 2 === 1
  return afuera ? 0 : t
}

// Contorno de una cara rectangular de w × h con un tipo de borde por lado.
// Bordes en orden: abajo, derecha, arriba, izquierda (sentido antihorario, Y hacia arriba).
function cara(
  w: number,
  h: number,
  bordes: [TipoBorde, TipoBorde, TipoBorde, TipoBorde],
  nW: number,
  nH: number,
  t: number
): Punto[] {
  const lados = [
    { inicio: [0, 0], u: [1, 0], v: [0, 1], largo: w, n: nW, tipo: bordes[0] },
    { inicio: [w, 0], u: [0, 1], v: [-1, 0], largo: h, n: nH, tipo: bordes[1] },
    { inicio: [w, h], u: [-1, 0], v: [0, -1], largo: w, n: nW, tipo: bordes[2] },
    { inicio: [0, h], u: [0, -1], v: [1, 0], largo: h, n: nH, tipo: bordes[3] },
  ]
  const pts: Punto[] = []
  for (let k = 0; k < 4; k++) {
    const L = lados[k]
    const prev = lados[(k + 3) % 4]
    const s = L.largo / L.n
    // esquina: desplazada según el último segmento del lado anterior y el primero de este
    const dPrev = profundidad(prev.tipo, prev.n - 1, t)
    const d0 = profundidad(L.tipo, 0, t)
    pts.push([
      L.inicio[0] + prev.v[0] * dPrev + L.v[0] * d0,
      L.inicio[1] + prev.v[1] * dPrev + L.v[1] * d0,
    ])
    for (let j = 1; j < L.n; j++) {
      const a = profundidad(L.tipo, j - 1, t)
      const b = profundidad(L.tipo, j, t)
      if (a === b) continue
      const bx = L.inicio[0] + L.u[0] * j * s
      const by = L.inicio[1] + L.u[1] * j * s
      pts.push([bx + L.v[0] * a, by + L.v[1] * a])
      pts.push([bx + L.v[0] * b, by + L.v[1] * b])
    }
  }
  return limpiar(pts)
}

const redondear = (x: number) => Math.round(x * 1e6) / 1e6

// quita puntos repetidos y puntos en línea recta
function limpiar(pts: Punto[]): Punto[] {
  let p = pts.map(([x, y]) => [redondear(x), redondear(y)] as Punto)
  p = p.filter((q, i) => {
    const r = p[(i + p.length - 1) % p.length]
    return !(q[0] === r[0] && q[1] === r[1])
  })
  let cambio = true
  while (cambio && p.length > 3) {
    cambio = false
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]
      const b = p[i]
      const c = p[(i + 1) % p.length]
      const cruz = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      if (Math.abs(cruz) < 1e-9) {
        p.splice(i, 1)
        cambio = true
        break
      }
    }
  }
  return p
}

// Agranda el contorno la mitad del kerf hacia afuera (polígono de ángulos rectos, antihorario)
function compensarKerf(pts: Punto[], kerf: number): Punto[] {
  if (!kerf) return pts
  const d = kerf / 2
  const n = pts.length
  return pts.map((b, i) => {
    const a = pts[(i + n - 1) % n]
    const c = pts[(i + 1) % n]
    const normal = (p: Punto, q: Punto): Punto => {
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      const l = Math.hypot(dx, dy) || 1
      return [dy / l, -dx / l] // hacia afuera en sentido antihorario
    }
    const n1 = normal(a, b)
    const n2 = normal(b, c)
    return [redondear(b[0] + (n1[0] + n2[0]) * d), redondear(b[1] + (n1[1] + n2[1]) * d)]
  })
}

// deja la esquina inferior izquierda del contorno en (0,0)
function aOrigen(pts: Punto[]) {
  const minX = Math.min(...pts.map((p) => p[0]))
  const minY = Math.min(...pts.map((p) => p[1]))
  const q = pts.map(([x, y]) => [redondear(x - minX), redondear(y - minY)] as Punto)
  return {
    contorno: q,
    ancho: redondear(Math.max(...q.map((p) => p[0]))),
    alto: redondear(Math.max(...q.map((p) => p[1]))),
  }
}

export function generarCaja(o: OpcionesCaja): ResultadoCaja {
  const errores: string[] = []
  const avisos: string[] = []
  const t = o.espesor
  const extra = o.medidas === "interiores" ? 2 * t : 0
  const W = o.ancho + extra
  const D = o.fondo + extra
  const H = o.alto + (o.medidas === "interiores" ? (o.tapa ? 2 * t : t) : 0)

  const vacio = (): ResultadoCaja => ({
    piezas: [],
    errores,
    avisos,
    exterior: { ancho: W, fondo: D, alto: H },
    interior: { ancho: W - 2 * t, fondo: D - 2 * t, alto: H - (o.tapa ? 2 : 1) * t },
    dedos: { ancho: 0, fondo: 0, alto: 0 },
  })

  if (![o.ancho, o.fondo, o.alto, t, o.dedo].every((x) => Number.isFinite(x) && x > 0)) {
    errores.push("Todas las medidas deben ser mayores que cero.")
    return vacio()
  }
  if (!(o.kerf >= 0 && o.kerf < t)) errores.push("El kerf debe ser 0 o mayor, y menor que el espesor.")
  if (Math.min(W, D, H) < 6 * t) errores.push("La caja es muy pequeña para ese espesor: cada lado debe medir al menos 6 veces el espesor.")
  if (errores.length) return vacio()

  const nW = segmentos(W, o.dedo)
  const nD = segmentos(D, o.dedo)
  const nH = segmentos(H, o.dedo)
  const minSeg = Math.min(W / nW, D / nD, H / nH)
  if (minSeg < 1.5 * t) {
    errores.push(`Los dedos quedan muy angostos (${minSeg.toFixed(1)} mm). Usa un dedo de al menos ${(2 * t).toFixed(1)} mm.`)
    return vacio()
  }
  if (o.dedo < 2 * t) avisos.push("Con dedos menores a 2 veces el espesor la unión queda débil.")
  if (o.kerf === 0) avisos.push("Sin kerf las uniones quedan sueltas en láser; en router usa 0 y compensa en el CAM.")

  const arriba: TipoBorde = o.tapa ? "A" : "L"
  const crudas: { nombre: string; pts: Punto[] }[] = [
    { nombre: "Base", pts: cara(W, D, ["B", "B", "B", "B"], nW, nD, t) },
    ...(o.tapa ? [{ nombre: "Tapa", pts: cara(W, D, ["B", "B", "B", "B"], nW, nD, t) }] : []),
    { nombre: "Frente", pts: cara(W, H, ["A", "A", arriba, "A"], nW, nH, t) },
    { nombre: "Atrás", pts: cara(W, H, ["A", "A", arriba, "A"], nW, nH, t) },
    { nombre: "Lateral izquierdo", pts: cara(D, H, ["A", "B", arriba, "B"], nD, nH, t) },
    { nombre: "Lateral derecho", pts: cara(D, H, ["A", "B", arriba, "B"], nD, nH, t) },
  ]

  const piezas = crudas.map(({ nombre, pts }) => ({ nombre, ...aOrigen(compensarKerf(pts, o.kerf)) }))
  return {
    piezas,
    errores,
    avisos,
    exterior: { ancho: W, fondo: D, alto: H },
    interior: { ancho: W - 2 * t, fondo: D - 2 * t, alto: H - (o.tapa ? 2 : 1) * t },
    dedos: { ancho: nW, fondo: nD, alto: nH },
  }
}

// ---------- Acomodo y exportación ----------

export type Colocada = Pieza & { x: number; y: number }

// Acomoda las piezas en filas de dos, con separación (mm)
export function acomodar(piezas: Pieza[], separacion = 5) {
  const colocadas: Colocada[] = []
  let y = 0
  let anchoTotal = 0
  for (let i = 0; i < piezas.length; i += 2) {
    const fila = piezas.slice(i, i + 2)
    let x = 0
    let altoFila = 0
    for (const p of fila) {
      colocadas.push({ ...p, x, y })
      x += p.ancho + separacion
      altoFila = Math.max(altoFila, p.alto)
    }
    anchoTotal = Math.max(anchoTotal, x - separacion)
    y += altoFila + separacion
  }
  return { colocadas, ancho: anchoTotal, alto: Math.max(0, y - separacion) }
}

const f = (x: number) => String(Math.round(x * 1000) / 1000)

// SVG en milímetros.
//  - modo "corte": rojo 0.1 mm = línea de corte (LightBurn, RDWorks, Inkscape), sin textos
//  - modo "vista": para la pantalla, con el nombre de cada pieza
export function aSVG(piezas: Pieza[], modo: "corte" | "vista" = "corte") {
  const { colocadas, ancho, alto } = acomodar(piezas)
  const m = 2 // margen
  const W = ancho + 2 * m
  const H = alto + 2 * m
  const vista = modo === "vista"
  const trazo = vista
    ? `fill="#FDEEE1" fill-opacity="0.55" stroke="#C2560A" stroke-width="1.4" vector-effect="non-scaling-stroke"`
    : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const cuerpos = colocadas
    .map((p) => {
      // el SVG tiene Y hacia abajo: cada pieza se voltea en su lugar
      const d =
        p.contorno
          .map(([x, y], i) => `${i ? "L" : "M"}${f(m + p.x + x)} ${f(m + p.y + p.alto - y)}`)
          .join(" ") + " Z"
      const etiqueta = vista
        ? `<text x="${f(m + p.x + p.ancho / 2)}" y="${f(m + p.y + p.alto / 2)}" font-size="${f(Math.max(3, Math.min(10, p.alto / 7, (0.8 * p.ancho) / (0.6 * p.nombre.length))))}" text-anchor="middle" dominant-baseline="middle" fill="#6B6A63" font-family="sans-serif">${p.nombre}</text>`
        : ""
      return `<path d="${d}" ${trazo}/>${etiqueta}`
    })
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpos}\n</svg>\n`
}

// DXF R12 con polilíneas cerradas en la capa CORTE, unidades mm
export function aDXF(piezas: Pieza[]) {
  const { colocadas } = acomodar(piezas)
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER")
  par(9, "$ACADVER"); par(1, "AC1009")
  par(9, "$INSUNITS"); par(70, 4)
  par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  for (const p of colocadas) {
    par(0, "POLYLINE"); par(8, "CORTE"); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
    for (const [x, y] of p.contorno) {
      par(0, "VERTEX"); par(8, "CORTE"); par(10, f(p.x + x)); par(20, f(p.y + y)); par(30, 0)
    }
    par(0, "SEQEND"); par(8, "CORTE")
  }
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}

// Área de material que ocupan las piezas (m²), para cotizar
export const areaMaterial = (piezas: Pieza[]) =>
  piezas.reduce((s, p) => s + p.ancho * p.alto, 0) / 1e6
