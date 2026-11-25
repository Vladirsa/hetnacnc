// Uniones de un plano HETNA, calculadas de la geometría (pedido del dueño,
// 25 nov 2026): dónde va cada tornillo o clavo, cuántos son y los barrenos guía
// de cada pieza para el DXF.
//
// Unión a tope: una pieza A presenta su CARA y la otra B su CANTO contra ella;
// el tornillo atraviesa el grosor de A y entra en el canto de B.
//   - A de 6 mm (respaldos, fondos): clavos o grapas, sin barreno.
//   - B de menos de 12 mm de canto: sólo pegamento y clavos (un tornillo lo raja).
//   - Lo demás: tornillo para madera; barreno guía de 3 mm en A.
//   - Puertas y tapas van con bisagra: no se atornillan al mueble.
// Cara con cara (listón sobre tablero, cubierta doble): tornillo desde la pieza
// chica hacia la grande, en una o dos filas.
// Posiciones: a 50 mm de cada orilla y a lo más cada 200 mm (clavos cada 150 mm).
import { MATERIALES_PLANO, type PiezaPlano, type Plano } from "./modelos"

export type Fijacion = "tornillo" | "clavo"
export type Union = { a: number; b: number; fijacion: Fijacion; cantidad: number; largoTornillo: string | null }
/** Barreno en coordenadas de la pieza: u a lo largo de su largo, v a lo largo de su ancho (mm). */
export type Barreno = { u: number; v: number }

const TOL = 0.6
const EJES = ["x", "y", "z"] as const
type Eje = (typeof EJES)[number]
const lo = (q: PiezaPlano, e: Eje) => q[`${e}0`]
const hi = (q: PiezaPlano, e: Eje) => q[`${e}1`]
const mide = (q: PiezaPlano, e: Eje) => hi(q, e) - lo(q, e)
const solapa = (a: PiezaPlano, b: PiezaPlano, e: Eje) => Math.min(hi(a, e), hi(b, e)) - Math.max(lo(a, e), lo(b, e))

/** Ejes de la pieza ordenados como la lista de corte: [grosor, ancho, largo]. */
export function ejesPieza(q: PiezaPlano): [Eje, Eje, Eje] {
  const o = [...EJES].sort((a, b) => mide(q, a) - mide(q, b))
  return [o[0], o[1], o[2]]
}

const movil = (q: PiezaPlano) => /^(puerta|tapa)\b/i.test(q.nombre)

const LARGO_TORNILLO: Record<number, string> = { 18: '1 1/2"', 12: '1 1/4"', 9: '1"' }

function posiciones(L: number, esp: number): number[] {
  if (L < 120) return [L / 2]
  const ins = Math.min(50, L / 4)
  const n = Math.max(2, Math.ceil((L - 2 * ins) / esp) + 1)
  return Array.from({ length: n }, (_, i) => ins + ((L - 2 * ins) * i) / (n - 1))
}

export type ResultadoUniones = { uniones: Union[]; barrenos: Barreno[][] }

export function unionesDe(pl: Plano): ResultadoUniones {
  const P = pl.piezas
  const barrenos: Barreno[][] = P.map(() => [])
  const uniones: Union[] = []
  const ejes = P.map(ejesPieza)
  const guardar = (a: number, puntos: Record<string, number>[]) => {
    const [, ejeV, ejeU] = ejes[a]
    for (const m of puntos) barrenos[a].push({ u: Math.round((m[ejeU] - lo(P[a], ejeU)) * 10) / 10, v: Math.round((m[ejeV] - lo(P[a], ejeV)) * 10) / 10 })
  }
  // Cara con cara (un listón sobre un tablero, una cubierta doble, una pata pegada):
  // se atornilla desde la pieza más chica hacia la grande, en una o dos filas.
  const caraConCara = (i: number, j: number, eje: Eje, otros: Eje[]) => {
    const area = (q: PiezaPlano) => otros.reduce((m, e) => m * mide(q, e), 1)
    const a = area(P[i]) <= area(P[j]) ? i : j, b = a === i ? j : i
    const ga = MATERIALES_PLANO[P[a].material].grosor, gb = MATERIALES_PLANO[P[b].material].grosor
    const fijacion: Fijacion = ga <= 6 || gb <= 6 ? "clavo" : "tornillo"
    const [e1, e2] = otros.map((e) => ({ e, a0: Math.max(lo(P[a], e), lo(P[b], e)), a1: Math.min(hi(P[a], e), hi(P[b], e)) })).sort((x, y) => (y.a1 - y.a0) - (x.a1 - x.a0))
    const largo = posiciones(e1.a1 - e1.a0, fijacion === "clavo" ? 150 : 200).map((d) => e1.a0 + d)
    const ancho = e2.a1 - e2.a0
    const filas = ancho > 160 ? [e2.a0 + 40, e2.a1 - 40] : [(e2.a0 + e2.a1) / 2]
    const puntos = largo.flatMap((p) => filas.map((f) => ({ [e1.e]: p, [e2.e]: f })))
    void eje
    uniones.push({ a, b, fijacion, cantidad: puntos.length, largoTornillo: fijacion === "tornillo" ? ({ 18: '1 1/4"', 12: '1"', 9: '3/4"' } as Record<number, string>)[ga] || '1 1/4"' : null })
    if (fijacion === "tornillo") guardar(a, puntos)
  }
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) {
      const s = EJES.map((e) => solapa(P[i], P[j], e))
      const k = EJES.findIndex((_, n) => Math.abs(s[n]) <= TOL)
      if (k < 0) continue
      const otros = EJES.filter((_, n) => n !== k)
      if (!otros.every((e) => solapa(P[i], P[j], e) > TOL)) continue
      const eje = EJES[k]
      // puertas y tapas van con bisagra: no se atornillan al mueble (sí entre sus propias piezas)
      if (movil(P[i]) !== movil(P[j])) continue
      // A: la que tiene su grosor en el eje del contacto (presenta la cara)
      const iCara = ejes[i][0] === eje, jCara = ejes[j][0] === eje
      if (!iCara && !jCara) continue // canto con canto: sólo pegamento
      if (iCara && jCara) {
        caraConCara(i, j, eje, otros)
        continue
      }
      const a = iCara ? i : j, b = iCara ? j : i
      const ga = MATERIALES_PLANO[P[a].material].grosor
      const gb = MATERIALES_PLANO[P[b].material].grosor
      const fijacion: Fijacion = ga <= 6 || gb < 12 ? "clavo" : "tornillo"
      // franja de contacto: a lo largo del canto de B, centrada en su grosor
      // el canto de B es su eje de grosor (siempre uno de los dos ejes del contacto)
      const angostoEje = ejes[b][0]
      const largoEje = otros.find((e) => e !== angostoEje)!
      const l0 = Math.max(lo(P[a], largoEje), lo(P[b], largoEje)), l1 = Math.min(hi(P[a], largoEje), hi(P[b], largoEje))
      const c0 = Math.max(lo(P[a], angostoEje), lo(P[b], angostoEje)), c1 = Math.min(hi(P[a], angostoEje), hi(P[b], angostoEje))
      const pos = posiciones(l1 - l0, fijacion === "clavo" ? 150 : 200).map((d) => l0 + d)
      uniones.push({ a, b, fijacion, cantidad: pos.length, largoTornillo: fijacion === "tornillo" ? LARGO_TORNILLO[ga] || '1 1/2"' : null })
      if (fijacion === "tornillo") guardar(a, pos.map((p) => ({ [largoEje]: p, [angostoEje]: (c0 + c1) / 2 })))
    }
  }
  return { uniones, barrenos }
}

/** Firma de los barrenos de una pieza que no cambia si la pieza se voltea (para agrupar piezas iguales). */
export function firmaBarrenos(q: PiezaPlano, b: Barreno[]): { firma: string; barrenos: Barreno[] } {
  const [, ev, eu] = ejesPieza(q)
  const L = mide(q, eu), W = mide(q, ev)
  const variantes: Barreno[][] = [
    b,
    b.map((p) => ({ u: L - p.u, v: p.v })),
    b.map((p) => ({ u: p.u, v: W - p.v })),
    b.map((p) => ({ u: L - p.u, v: W - p.v })),
  ]
  if (Math.abs(L - W) < 0.5) variantes.push(...variantes.map((vs) => vs.map((p) => ({ u: p.v, v: p.u }))))
  const texto = (vs: Barreno[]) => vs.map((p) => `${Math.round(p.u)},${Math.round(p.v)}`).sort().join(";")
  let mejor = variantes[0]
  for (const vs of variantes) if (texto(vs) < texto(mejor)) mejor = vs
  return { firma: texto(mejor), barrenos: mejor }
}

export type Tornilleria = { tornillos: { largo: string; cantidad: number }[]; clavos: number; barrenos: number }

/** Totales para la lista de herrajes. */
export function tornilleria(pl: Plano, r: ResultadoUniones = unionesDe(pl)): Tornilleria {
  const k = pl.juego?.cantidad ?? 1
  const porLargo = new Map<string, number>()
  let clavos = 0
  for (const u of r.uniones) {
    if (u.fijacion === "tornillo") porLargo.set(u.largoTornillo!, (porLargo.get(u.largoTornillo!) || 0) + u.cantidad * k)
    else clavos += u.cantidad * k
  }
  return {
    tornillos: [...porLargo.entries()].map(([largo, cantidad]) => ({ largo, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
    clavos,
    barrenos: r.barrenos.reduce((s, b) => s + b.length, 0) * k,
  }
}
