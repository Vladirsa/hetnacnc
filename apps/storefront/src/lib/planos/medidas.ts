// "Modifica las medidas" de un plano HETNA: el mismo mueble a otro ancho,
// fondo o alto sin deformar el triplay.
//
// En cada eje, los tramos que ocupan los espesores (un costado, un piso, un
// respaldo) se quedan del mismo grosor y los huecos entre ellos se estiran o
// se encogen para llegar a la medida pedida. Así un librero más ancho sigue
// teniendo costados de 18 mm y sólo crecen las repisas.
import type { PiezaPlano, Plano } from "./modelos"

export type Medidas = { ancho: number; fondo: number; alto: number }
type Eje = "x" | "y" | "z"

/** Cuánto se deja cambiar cada medida respecto a la original. */
export const LIMITE = { min: 0.5, max: 2 }
const MIN_MM = 150

const espesor = (q: PiezaPlano) => Math.min(q.x1 - q.x0, q.y1 - q.y0, q.z1 - q.z0)
const largo = (q: PiezaPlano, e: Eje) => (e === "x" ? q.x1 - q.x0 : e === "y" ? q.y1 - q.y0 : q.z1 - q.z0)
const ini = (q: PiezaPlano, e: Eje) => (e === "x" ? q.x0 : e === "y" ? q.y0 : q.z0)
const fin = (q: PiezaPlano, e: Eje) => (e === "x" ? q.x1 : e === "y" ? q.y1 : q.z1)

/** Función que lleva una coordenada del eje a la nueva medida (lineal por tramos). */
function mapeo(piezas: PiezaPlano[], e: Eje, objetivo: number): ((c: number) => number) | null {
  const cortes = [...new Set(piezas.flatMap((q) => [ini(q, e), fin(q, e)]))].sort((a, b) => a - b)
  const a0 = cortes[0], a1 = cortes[cortes.length - 1]
  const total = a1 - a0
  if (total <= 0 || Math.abs(objetivo - total) < 0.5) return null
  // tramo rígido: cae dentro del espesor de una pieza que tiene su grosor en este eje
  const rigidas = piezas.filter((q) => Math.abs(largo(q, e) - espesor(q)) < 0.01)
  const tramos = cortes.slice(0, -1).map((c, i) => {
    const d = cortes[i + 1]
    const m = (c + d) / 2
    return { c, d, rigido: rigidas.some((q) => ini(q, e) <= m && m <= fin(q, e)) }
  })
  const fijo = tramos.filter((t) => t.rigido).reduce((s, t) => s + (t.d - t.c), 0)
  const libre = total - fijo
  if (libre <= 0 || objetivo - fijo <= 0) return null
  const k = (objetivo - fijo) / libre
  const nuevos = [a0]
  for (const t of tramos) nuevos.push(nuevos[nuevos.length - 1] + (t.d - t.c) * (t.rigido ? 1 : k))
  return (v: number) => {
    let i = cortes.findIndex((c) => c >= v - 1e-6)
    if (i < 0) i = cortes.length - 1
    if (Math.abs(cortes[i] - v) < 1e-6) return nuevos[i]
    const lo = Math.max(0, i - 1)
    return nuevos[lo] + ((v - cortes[lo]) / (cortes[i] - cortes[lo])) * (nuevos[i] - nuevos[lo])
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Medidas generales (ancho × fondo × alto), con las ruedas en el alto. */
export function medidasDe(piezas: PiezaPlano[], ruedas = 0): Medidas {
  const rango = (e: Eje) => Math.max(...piezas.map((q) => fin(q, e))) - Math.min(...piezas.map((q) => ini(q, e)))
  return { ancho: r1(rango("x")), fondo: r1(rango("y")), alto: r1(rango("z") + ruedas) }
}

/** Ajusta la medida pedida a los límites permitidos (50 % a 200 % y mínimo 15 cm). */
export function limitar(original: Medidas, pedida: Partial<Medidas>): Medidas {
  const f = (k: keyof Medidas) => {
    const o = original[k]
    const v = Number(pedida[k])
    if (!Number.isFinite(v) || v <= 0) return o
    return Math.round(Math.min(o * LIMITE.max, Math.max(Math.min(o, Math.max(MIN_MM, o * LIMITE.min)), v)))
  }
  return { ancho: f("ancho"), fondo: f("fondo"), alto: f("alto") }
}

/** El plano a otras medidas. Devuelve el mismo plano si no cambian. */
export function redimensionar(pl: Plano, pedida: Partial<Medidas>): Plano {
  const ruedas = pl.ruedas ?? 0
  const orig = medidasDe(pl.piezas, ruedas)
  const m = limitar(orig, pedida)
  const fx = mapeo(pl.piezas, "x", m.ancho)
  const fy = mapeo(pl.piezas, "y", m.fondo)
  const fz = mapeo(pl.piezas, "z", m.alto - ruedas)
  if (!fx && !fy && !fz) return pl
  const id = (v: number) => v
  const X = fx || id, Y = fy || id, Z = fz || id
  const piezas = pl.piezas.map((q) => ({ ...q, x0: r1(X(q.x0)), x1: r1(X(q.x1)), y0: r1(Y(q.y0)), y1: r1(Y(q.y1)), z0: r1(Z(q.z0)), z1: r1(Z(q.z1)) }))
  return { ...pl, piezas }
}

/** Lee ?ancho=&fondo=&alto= de la URL. */
export function medidasDeConsulta(q: Record<string, string | string[] | undefined>): Partial<Medidas> {
  const n = (k: string) => {
    const v = Array.isArray(q[k]) ? q[k]![0] : q[k]
    const x = Number(v)
    return Number.isFinite(x) && x > 0 ? x : undefined
  }
  return { ancho: n("ancho"), fondo: n("fondo"), alto: n("alto") }
}
