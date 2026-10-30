// Rompecabezas para corte láser: una placa (MDF, triplay, acrílico) con las
// líneas de corte en forma de pieza de rompecabezas clásica. Cada línea
// interior va de orilla a orilla como un solo trazo abierto, así el láser no
// levanta y baja en cada pieza. Opcional: marco y base para armarlo encima.
//
// Las curvas siguen el método de Draradech (jigsaw.js, dominio público):
// cada orilla entre dos piezas es tres curvas Bézier con un nudo que mira a
// un lado o al otro al azar, con pequeñas variaciones para que ninguna pieza
// sea igual. Todo en milímetros, Y hacia arriba.

import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

export type OpcionesRompecabezas = {
  ancho: number
  alto: number
  columnas: number
  filas: number
  nudo: number // tamaño del nudo, fracción del lado de la pieza (0.1–0.3; 0.2 es clásico)
  variacion: number // qué tan irregulares son las piezas (0–0.1; 0.04 es clásico)
  semilla: number // mismo número = mismo rompecabezas
  esquinas: number // radio de las esquinas de la placa
  marco: number // ancho del marco (0 = sin marco ni base)
  holgura: number // espacio entre el rompecabezas y el marco
}

export type ResultadoRompecabezas = {
  dibujo: Dibujo
  piezas: number
  piezaAncho: number
  piezaAlto: number
  avisos: string[]
  errores: string[]
}

const PASOS = 12 // segmentos por curva Bézier

function bezier(p0: P, p1: P, p2: P, p3: P, salida: P[]) {
  for (let i = 1; i <= PASOS; i++) {
    const s = i / PASOS
    const u = 1 - s
    salida.push([
      u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
      u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1],
    ])
  }
}

function rectRedondo(x0: number, y0: number, x1: number, y1: number, r: number): P[] {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2))
  if (r < 0.01) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const pts: P[] = []
  const esq: [number, number, number][] = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]
  for (const [cx, cy, a0] of esq) for (let j = 0; j <= 8; j++) pts.push([cx + r * Math.cos(a0 + (Math.PI / 2) * (j / 8)), cy + r * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
  return pts
}

export function hacerRompecabezas(o: OpcionesRompecabezas): ResultadoRompecabezas {
  const errores: string[] = []
  const avisos: string[] = []
  const vacio = (e: string): ResultadoRompecabezas => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, piezas: 0, piezaAncho: 0, piezaAlto: 0, avisos, errores: [e] })
  if (!(o.ancho >= 30) || !(o.alto >= 30)) return vacio("La placa debe medir al menos 30 × 30 mm.")
  if (!(o.columnas >= 2) || !(o.filas >= 2)) return vacio("Pon al menos 2 columnas y 2 filas.")
  if (o.columnas > 60 || o.filas > 60) return vacio("Máximo 60 columnas y 60 filas.")

  const xn = Math.round(o.columnas)
  const yn = Math.round(o.filas)
  const W = o.ancho
  const H = o.alto
  // En jigsaw.js el tamaño del nudo se divide entre 2 (20 % → t = 0.1)
  const t = Math.min(0.35, Math.max(0.05, o.nudo || 0.2)) / 2
  const j = Math.min(0.15, Math.max(0, o.variacion || 0))
  const piezaAncho = W / xn
  const piezaAlto = H / yn
  if (Math.min(piezaAncho, piezaAlto) < 8) avisos.push("Piezas muy chicas (menos de 8 mm): se pueden quemar o perder. Usa menos piezas o una placa más grande.")
  if (piezaAncho / piezaAlto > 1.6 || piezaAlto / piezaAncho > 1.6) avisos.push("Las piezas quedan muy alargadas; ajusta columnas y filas para que sean casi cuadradas.")

  // Azar repetible
  let semilla = Math.floor(o.semilla) || 1
  const random = () => {
    const x = Math.sin(semilla) * 10000
    semilla += 1
    return x - Math.floor(x)
  }
  const uniforme = (a: number, b: number) => a + random() * (b - a)

  // Estado de una orilla (como en jigsaw.js)
  let a = 0, b = 0, c = 0, d = 0, e = 0
  let flip = false
  const siguiente = () => {
    const flipViejo = flip
    flip = random() > 0.5
    a = flip === flipViejo ? -e : e
    b = uniforme(-j, j)
    c = uniforme(-j, j)
    d = uniforme(-j, j)
    e = uniforme(-j, j)
  }
  const primera = () => {
    e = uniforme(-j, j)
    siguiente()
  }

  const trazos: Trazo[] = []

  // Línea interior: `vertical` false → recorre en X a la altura `pos`;
  // true → recorre en Y en la posición X `pos`.
  const linea = (vertical: boolean, pos: number) => {
    const n = vertical ? yn : xn
    const sl = vertical ? piezaAlto : piezaAncho // largo de una pieza en la dirección de avance
    const sw = vertical ? piezaAncho : piezaAlto // ancho de la pieza, hacia donde sale el nudo
    const pts: P[] = []
    primera()
    const punto = (l: number, w: number, i: number): P => {
      const L = sl * (i + l)
      const Wd = pos + sw * w * (flip ? -1 : 1)
      return vertical ? [Wd, L] : [L, Wd]
    }
    pts.push(punto(0, 0, 0))
    for (let i = 0; i < n; i++) {
      const p0 = punto(0, 0, i)
      bezier(p0, punto(0.2, a, i), punto(0.5 + b + d, -t + c, i), punto(0.5 - t + b, t + c, i), pts)
      bezier(punto(0.5 - t + b, t + c, i), punto(0.5 - 2 * t + b - d, 3 * t + c, i), punto(0.5 + 2 * t + b - d, 3 * t + c, i), punto(0.5 + t + b, t + c, i), pts)
      bezier(punto(0.5 + t + b, t + c, i), punto(0.5 + b + d, -t + c, i), punto(0.8, e, i), punto(1, 0, i), pts)
      siguiente()
    }
    trazos.push({ pts, cerrado: false, capa: "CORTE" })
  }

  for (let yi = 1; yi < yn; yi++) linea(false, yi * piezaAlto)
  for (let xi = 1; xi < xn; xi++) linea(true, xi * piezaAncho)

  // Placa
  trazos.push({ pts: rectRedondo(0, 0, W, H, o.esquinas), cerrado: true, capa: "CORTE" })

  // Marco (anillo) y base, a la derecha del rompecabezas
  const m = Math.max(0, o.marco)
  if (m > 0) {
    const h = Math.max(0, o.holgura)
    const x0 = W + 15
    const Wm = W + 2 * h + 2 * m
    const Hm = H + 2 * h + 2 * m
    trazos.push({ pts: rectRedondo(x0, 0, x0 + Wm, Hm, o.esquinas + m), cerrado: true, capa: "MARCO" })
    trazos.push({ pts: rectRedondo(x0 + m, m, x0 + m + W + 2 * h, m + H + 2 * h, o.esquinas), cerrado: true, capa: "MARCO" })
    const xb = x0 + Wm + 15
    trazos.push({ pts: rectRedondo(xb, 0, xb + Wm, Hm, o.esquinas + m), cerrado: true, capa: "BASE" })
  }

  return { dibujo: { trazos, avisos: [], unidades: "mm" }, piezas: xn * yn, piezaAncho, piezaAlto, avisos, errores }
}
