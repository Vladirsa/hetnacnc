// Cocina integral en una pared: una fila de gabinetes bajos con cubierta corrida
// y, opcional, gabinetes altos alineados encima. Cada módulo sale del asistente
// de gabinete (gabinete.ts) y se coloca en su lugar; el motor arma cada uno por
// separado (opción "varios") y todo queda en un solo diseño: una lista de corte,
// un acomodo y una lista de compra.
//
// Ejes: X a lo largo de la pared (0 = esquina izquierda), Y fondo (0 = frente
// de los bajos), Z alto. Medidas en mm.

import type { TableroC } from "./componentes"
import { GABINETE_INICIO, gabinete } from "./gabinete"

export type TipoModulo = "puertas" | "fregadero" | "cajonera" | "columna"
export type Modulo = { tipo: TipoModulo; ancho: number }
export const MODULOS: { id: TipoModulo; nombre: string }[] = [
  { id: "puertas", nombre: "Bajo con puertas" },
  { id: "fregadero", nombre: "Fregadero" },
  { id: "cajonera", nombre: "Cajonera" },
  { id: "columna", nombre: "Columna (alacena)" },
]

export type OpcionesCocina = {
  modulos: Modulo[]
  grosor: number
  altoBajos: number // sin cubierta
  fondoBajos: number
  zoclo: number
  conAltos: boolean
  altoAltos: number
  fondoAltos: number
  alturaAltos: number // del piso a la base de los altos
  cubierta: boolean
  gCubierta: number
  altoColumna: number
}

export const COCINA_INICIO: Omit<OpcionesCocina, "modulos" | "grosor"> = {
  altoBajos: 720,
  fondoBajos: 560,
  zoclo: 100,
  conAltos: true,
  altoAltos: 720,
  fondoAltos: 320,
  alturaAltos: 1450,
  cubierta: true,
  gCubierta: 28,
  altoColumna: 2170,
}

// Propone módulos para una pared: fregadero al centro (800), una cajonera junto
// a él y el resto en gabinetes de puertas de ancho parejo (entre 400 y 900).
export function proponerModulos(largo: number, conColumna: boolean): Modulo[] {
  const L = Math.max(600, Math.min(8000, largo))
  const col = conColumna && L >= 1800 ? 600 : 0
  const resto = L - col
  const freg = resto >= 1400 ? 800 : Math.min(800, resto)
  const caj = resto - freg >= 1000 ? 600 : 0
  const lados = resto - freg - caj
  const repartir = (w: number): Modulo[] => {
    if (w < 150) return []
    const n = Math.max(1, Math.round(w / 650))
    const a = Math.round((w / n) * 10) / 10
    return Array.from({ length: n }, () => ({ tipo: "puertas" as TipoModulo, ancho: a }))
  }
  const izq = repartir(lados / 2)
  const der = repartir(lados - izq.reduce((t, m) => t + m.ancho, 0))
  const mods: Modulo[] = [...izq, { tipo: "fregadero", ancho: freg }, ...(caj ? [{ tipo: "cajonera" as TipoModulo, ancho: caj }] : []), ...der]
  // lo que sobra por redondeo se le da al último bajo
  const suma = mods.reduce((t, m) => t + m.ancho, 0)
  mods[mods.length - 1].ancho = Math.round((mods[mods.length - 1].ancho + resto - suma) * 10) / 10
  if (col) mods.push({ tipo: "columna", ancho: col })
  return mods
}

export function cocina(o: OpcionesCocina): { tableros: TableroC[]; avisos: string[]; largo: number } {
  const avisos: string[] = []
  const t: TableroC[] = []
  let x = 0
  const bajos: [number, number][] = [] // tramos de x con gabinete bajo (para la cubierta)
  o.modulos.forEach((m, i) => {
    const ancho = Math.max(150, Math.min(1200, m.ancho))
    const n = `M${i + 1}`
    const mover = (ts: TableroC[], dx: number, dz: number, prefijo: string, dy = 0) =>
      ts.map((b) => ({ ...b, nombre: `${prefijo} ${b.nombre}`, x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy, z0: b.z0 + dz, z1: b.z1 + dz }))
    if (m.tipo === "columna") {
      const g = gabinete({ ...GABINETE_INICIO.columna, ancho, alto: o.altoColumna, fondo: o.fondoBajos, zoclo: o.zoclo, grosor: o.grosor, gFrente: o.grosor })
      t.push(...mover(g.tableros, x, 0, `${n} columna:`))
      avisos.push(...g.avisos)
    } else {
      const base = { ...GABINETE_INICIO.bajo, ancho, alto: o.altoBajos, fondo: o.fondoBajos, zoclo: o.zoclo, grosor: o.grosor, gFrente: o.grosor }
      const g =
        m.tipo === "fregadero"
          ? gabinete({ ...base, fondoTipo: "sin", techo: "travesanos", repisas: 0, frente: "puertas" })
          : m.tipo === "cajonera"
            ? gabinete({ ...base, frente: "cajones", cajones: 3 })
            : gabinete({ ...base, frente: ancho >= 500 ? "puertas" : "puerta", repisas: 1 })
      t.push(...mover(g.tableros, x, 0, `${n} ${m.tipo === "fregadero" ? "fregadero" : m.tipo === "cajonera" ? "cajonera" : "bajo"}:`))
      avisos.push(...g.avisos)
      bajos.push([x, x + ancho])
      if (o.conAltos) {
        const ga = gabinete({ ...GABINETE_INICIO.alto, ancho, alto: o.altoAltos, fondo: o.fondoAltos, grosor: o.grosor, gFrente: o.grosor, frente: ancho >= 500 ? "puertas" : "puerta" })
        // los altos van contra la pared (atrás)
        t.push(...mover(ga.tableros, x, o.alturaAltos, `${n} alto:`, o.fondoBajos - o.fondoAltos))
      }
    }
    x += ancho
  })
  // cubierta corrida sobre cada tramo seguido de bajos (la columna la corta)
  if (o.cubierta && bajos.length) {
    const tramos: [number, number][] = []
    for (const b of bajos) {
      const ult = tramos[tramos.length - 1]
      if (ult && Math.abs(ult[1] - b[0]) < 0.5) ult[1] = b[1]
      else tramos.push([...b])
    }
    // un tramo de más de 2440 mm no cabe en un tablero: se parte en la unión de dos módulos
    const cortes = new Set(bajos.map((b) => Math.round(b[1] * 10) / 10))
    const partes: [number, number][] = []
    const partir = (a: number, b: number) => {
      if (b - a <= 2440) return partes.push([a, b])
      const posibles = [...cortes].filter((c) => c > a + 1 && c < b - 1 && c - a <= 2440)
      if (!posibles.length) return partes.push([a, b])
      // el corte más cercano a la mitad que deje la primera parte de 2440 o menos
      const c = posibles.sort((x, y) => Math.abs(x - (a + b) / 2) - Math.abs(y - (a + b) / 2))[0]
      partir(a, c)
      partir(c, b)
    }
    for (const [a, b] of tramos) partir(a, b)
    if (partes.length > tramos.length) avisos.push(`La cubierta se parte en ${partes.length} piezas en la unión de los módulos: se juntan con tornillo de unión para cubierta y silicón.`)
    partes.forEach(([a, b], k) => {
      if (b - a > 2440) avisos.push(`La cubierta ${k + 1} mide ${Math.round(b - a)} mm y no cabe en un tablero de 2440: pide una cubierta de 3050 mm.`)
      t.push({ nombre: partes.length > 1 ? `Cubierta ${k + 1}` : "Cubierta", plano: "horizontal", rol: "cubierta", material: "encino", x0: a, x1: b, y0: -o.grosor - 20, y1: o.fondoBajos, z0: o.altoBajos, z1: o.altoBajos + o.gCubierta })
    })
  }
  if (o.conAltos && o.alturaAltos < o.altoBajos + o.gCubierta + 450) avisos.push("Los gabinetes altos quedan muy cerca de la cubierta: súbelos (lo común es dejar 600 mm).")
  return { tableros: t, avisos, largo: x }
}
