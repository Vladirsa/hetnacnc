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

export type TipoModulo = "puertas" | "fregadero" | "cajonera" | "columna" | "esquina" | "hueco" | "parrilla" | "estufa" | "refri" | "lavavajillas"
// esquina: esquinero ciego (ciegoLado = donde llega el otro tramo); hueco: espacio libre (puerta, estufa, refri)
// sinAlto: no lleva gabinete alto encima (ventana)
export type Modulo = { tipo: TipoModulo; ancho: number; sinAlto?: boolean; ciegoLado?: "izq" | "der"; ciego?: number }
export const MODULOS: { id: TipoModulo; nombre: string }[] = [
  { id: "puertas", nombre: "Bajo con puertas" },
  { id: "fregadero", nombre: "Fregadero" },
  { id: "cajonera", nombre: "Cajonera" },
  { id: "columna", nombre: "Columna (alacena)" },
  { id: "esquina", nombre: "Esquinero ciego" },
  { id: "hueco", nombre: "Espacio libre" },
  { id: "parrilla", nombre: "Bajo con parrilla (recorte en la cubierta)" },
  { id: "estufa", nombre: "Estufa (de piso)" },
  { id: "refri", nombre: "Refrigerador" },
  { id: "lavavajillas", nombre: "Lavavajillas" },
]
// electrodomésticos: sólo se dibujan (no son piezas); la parrilla sí corta la cubierta
export type Aparato = { tipo: "refri" | "estufa" | "parrilla" | "lavavajillas" | "campana" | "chimenea"; lo: [number, number, number]; hi: [number, number, number] }

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
  repisasMovibles?: boolean // repisas sobre pines (sistema 32)
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

export function cocina(o: OpcionesCocina): { tableros: TableroC[]; avisos: string[]; largo: number; aparatos: Aparato[] } {
  const avisos: string[] = []
  const t: TableroC[] = []
  const aparatos: Aparato[] = []
  const parrillas: number[] = [] // centro en X de cada parrilla (para el recorte de la cubierta)
  const zCubierta = o.altoBajos + o.gCubierta
  // campana sobre la estufa o la parrilla (en lugar del gabinete alto)
  const campana = (x0: number, ancho: number) => {
    if (!o.conAltos) return
    const w = Math.min(900, ancho)
    const cx = x0 + ancho / 2
    const z0 = Math.max(zCubierta + 650, o.alturaAltos)
    aparatos.push({ tipo: "campana", lo: [cx - w / 2, o.fondoBajos - 500, z0], hi: [cx + w / 2, o.fondoBajos, z0 + 120] })
    aparatos.push({ tipo: "chimenea", lo: [cx - 130, o.fondoBajos - 260, z0 + 120], hi: [cx + 130, o.fondoBajos, Math.max(z0 + 400, o.alturaAltos + o.altoAltos)] })
  }
  let x = 0
  const bajos: [number, number][] = [] // tramos de x con gabinete bajo (para la cubierta)
  o.modulos.forEach((m, i) => {
    if (m.tipo === "hueco") {
      x += Math.max(0, m.ancho)
      return
    }
    if (m.tipo === "refri" || m.tipo === "estufa" || m.tipo === "lavavajillas") {
      const a = Math.max(450, Math.min(1000, m.ancho))
      if (m.tipo === "refri") aparatos.push({ tipo: "refri", lo: [x + 10, -40, 0], hi: [x + a - 10, o.fondoBajos, 1800] })
      if (m.tipo === "estufa") {
        aparatos.push({ tipo: "estufa", lo: [x + 5, -30, 0], hi: [x + a - 5, o.fondoBajos - 20, zCubierta] })
        campana(x, a)
      }
      if (m.tipo === "lavavajillas") {
        aparatos.push({ tipo: "lavavajillas", lo: [x + 2, -o.grosor, 0], hi: [x + a - 2, o.fondoBajos - 20, o.altoBajos - 3] })
        bajos.push([x, x + a]) // la cubierta sigue encima
        if (o.conAltos && !m.sinAlto) {
          const ga = gabinete({ ...GABINETE_INICIO.alto, ancho: a, alto: o.altoAltos, fondo: o.fondoAltos, grosor: o.grosor, gFrente: o.grosor, frente: a >= 500 ? "puertas" : "puerta", repisasMovibles: o.repisasMovibles })
          t.push(...ga.tableros.map((b) => ({ ...b, nombre: `M${i + 1} alto: ${b.nombre}`, x0: b.x0 + x, x1: b.x1 + x, y0: b.y0 + o.fondoBajos - o.fondoAltos, y1: b.y1 + o.fondoBajos - o.fondoAltos, z0: b.z0 + o.alturaAltos, z1: b.z1 + o.alturaAltos })))
        }
      }
      x += a
      return
    }
    const ancho = Math.max(150, Math.min(1200, m.ancho))
    const n = `M${i + 1}`
    const mover = (ts: TableroC[], dx: number, dz: number, prefijo: string, dy = 0) =>
      ts.map((b) => ({ ...b, nombre: `${prefijo} ${b.nombre}`, x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy, z0: b.z0 + dz, z1: b.z1 + dz }))
    if (m.tipo === "columna") {
      const g = gabinete({ ...GABINETE_INICIO.columna, ancho, alto: o.altoColumna, fondo: o.fondoBajos, zoclo: o.zoclo, grosor: o.grosor, gFrente: o.grosor, repisasMovibles: o.repisasMovibles })
      t.push(...mover(g.tableros, x, 0, `${n} columna:`))
      avisos.push(...g.avisos)
    } else {
      const base = { ...GABINETE_INICIO.bajo, ancho, alto: o.altoBajos, fondo: o.fondoBajos, zoclo: o.zoclo, grosor: o.grosor, gFrente: o.grosor, repisasMovibles: o.repisasMovibles }
      const g =
        m.tipo === "fregadero"
          ? gabinete({ ...base, fondoTipo: "sin", techo: "travesanos", repisas: 0, frente: "puertas" })
          : m.tipo === "cajonera"
            ? gabinete({ ...base, frente: "cajones", cajones: 3 })
            : m.tipo === "esquina"
              ? gabinete({ ...base, frente: "esquinero", repisas: 1, ciegoLado: m.ciegoLado, ciego: m.ciego })
              : m.tipo === "parrilla"
                ? gabinete({ ...base, frente: ancho >= 500 ? "puertas" : "puerta", repisas: 0 })
            : gabinete({ ...base, frente: ancho >= 500 ? "puertas" : "puerta", repisas: 1 })
      t.push(...mover(g.tableros, x, 0, `${n} ${m.tipo === "fregadero" ? "fregadero" : m.tipo === "cajonera" ? "cajonera" : m.tipo === "esquina" ? "esquinero" : m.tipo === "parrilla" ? "parrilla" : "bajo"}:`))
      avisos.push(...g.avisos)
      bajos.push([x, x + ancho])
      if (m.tipo === "parrilla") {
        parrillas.push(x + ancho / 2)
        const w = Math.min(600, ancho - 60)
        aparatos.push({ tipo: "parrilla", lo: [x + ancho / 2 - w / 2, o.fondoBajos / 2 - 255, zCubierta], hi: [x + ancho / 2 + w / 2, o.fondoBajos / 2 + 255, zCubierta + 8] })
        campana(x, ancho)
      } else if (o.conAltos && !m.sinAlto) {
        const ga = gabinete({ ...GABINETE_INICIO.alto, ancho, alto: o.altoAltos, fondo: o.fondoAltos, grosor: o.grosor, gFrente: o.grosor, frente: ancho >= 500 ? "puertas" : "puerta", repisasMovibles: o.repisasMovibles })
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
      // recorte de cada parrilla que cae en esta parte (560 × 490, al centro del fondo)
      const y0 = -o.grosor - 20
      // (si el tramo es angosto el recorte se achica hasta 500 mm: parrilla de 50 cm)
      const aberturas = parrillas
        .filter((c) => c > a && c < b)
        .map((c) => ({ c, mitad: Math.min(280, c - a - 15, b - c - 15) }))
        .filter(({ mitad }) => mitad >= 250)
        .map(({ c, mitad }) => {
          if (mitad < 280) avisos.push(`El recorte de la parrilla queda de ${Math.round(mitad * 2)} mm: usa una parrilla de 50 cm o haz más ancho ese gabinete.`)
          return { u0: c - mitad - a, u1: c + mitad - a, v0: o.fondoBajos / 2 - 245 - y0, v1: o.fondoBajos / 2 + 245 - y0 }
        })
      for (const c of parrillas) if (c > a && c < b && Math.min(c - a, b - c) - 15 < 250) avisos.push("La parrilla no cabe en ese tramo de cubierta: hazlo más ancho (60 cm o más).")
      t.push({ nombre: partes.length > 1 ? `Cubierta ${k + 1}` : "Cubierta", plano: "horizontal", rol: "cubierta", material: "encino", x0: a, x1: b, y0, y1: o.fondoBajos, z0: o.altoBajos, z1: o.altoBajos + o.gCubierta, ...(aberturas.length ? { aberturas } : {}) })
    })
  }
  if (o.conAltos && o.alturaAltos < o.altoBajos + o.gCubierta + 450) avisos.push("Los gabinetes altos quedan muy cerca de la cubierta: súbelos (lo común es dejar 600 mm).")
  if (parrillas.length && !o.cubierta) avisos.push("La parrilla necesita cubierta para el recorte.")
  return { tableros: t, avisos, largo: x, aparatos }
}

// ---------------------------------------------------------------------------
// Cocina en una habitación: recta, en L o en U, con ventanas, puertas e isla.
//
// Cada pared se arma derecha con cocina() (así las bisagras, jaladeras, cantos
// y barrenos salen igual que siempre) y para fabricar quedan una tras otra a lo
// largo de X. "colocacion" dice cómo girar y mover cada tramo para verlo en la
// habitación: pared del fondo (A) a lo largo de X con su espalda en Y = fondo,
// pared izquierda en X = 0 y derecha en X = largo de A; el cuarto crece hacia
// Y negativo (hacia el frente).

export type Abertura = { tipo: "ventana" | "puerta"; pared: number; desde: number; ancho: number; alto: number; sobrePiso: number }
export type FormaCocina = "recta" | "L" | "U"
export type OpcionesHabitacion = Omit<OpcionesCocina, "modulos"> & {
  forma: FormaCocina
  ladoL: "izq" | "der" // en L: de qué lado está la segunda pared
  largos: number[] // [fondo, izquierda o derecha (L), derecha (U)]
  aberturas: Abertura[] // "desde": de la esquina izquierda en la pared del fondo; de la esquina en las paredes de los lados
  altoTecho: number
  conColumna: boolean
  isla?: { largo: number; distancia: number } // distancia: pasillo entre los frentes
  refri?: boolean
  estufa?: "parrilla" | "libre" | "ninguna"
  lavavajillas?: boolean
}
// x0..x1: qué parte de X es de este tramo; origen: la X que va a la esquina del tramo
export type Colocacion = { x0: number; x1: number; origen: number; giro: number; dx: number; dy: number }
export type CajaAmbiente = { lo: [number, number, number]; hi: [number, number, number] }

export const HABITACION_INICIO: Omit<OpcionesHabitacion, "grosor"> = {
  ...COCINA_INICIO,
  forma: "L",
  ladoL: "izq",
  largos: [3200, 2400, 2400],
  aberturas: [{ tipo: "ventana", pared: 0, desde: 1500, ancho: 1000, alto: 1000, sobrePiso: 1100 }],
  altoTecho: 2500,
  conColumna: true,
  refri: true,
  estufa: "parrilla",
  lavavajillas: false,
}

const PASILLO_ESQUINA = 20 // separación del tramo del lado contra el frente de la esquina (además del vuelo de la cubierta)

// reparte un tramo libre en gabinetes de puertas de 400 a 900
function repartir(w: number, sinAlto: (a: number, b: number) => boolean, x0: number): Modulo[] {
  if (w < 1) return []
  if (w < 250) return [{ tipo: "hueco", ancho: w }]
  const n = Math.max(1, Math.round(w / 650))
  const a = Math.round((w / n) * 10) / 10
  const r: Modulo[] = []
  let x = x0
  for (let i = 0; i < n; i++) {
    const an = i === n - 1 ? Math.round((x0 + w - x) * 10) / 10 : a
    r.push({ tipo: "puertas", ancho: an, sinAlto: sinAlto(x, x + an) || undefined })
    x += an
  }
  return r
}

export function habitacion(o: OpcionesHabitacion): { tableros: TableroC[]; avisos: string[]; colocacion: Colocacion[]; muros: CajaAmbiente[]; vidrios: CajaAmbiente[]; aparatos: Aparato[] } {
  const avisos: string[] = []
  const F = o.fondoBajos
  const gF = o.grosor
  const vuelo = o.grosor + 20 // la cubierta sale esto al frente
  const sep = vuelo + PASILLO_ESQUINA // del plano de la pared A al primer gabinete del lado
  const LA = Math.max(1200, Math.min(9000, o.largos[0] || 3000))
  const lados: { pared: number; lado: "izq" | "der" }[] =
    o.forma === "recta" ? [] : o.forma === "L" ? [{ pared: 1, lado: o.ladoL }] : [{ pared: 1, lado: "izq" }, { pared: 2, lado: "der" }]
  const hayIzq = lados.some((l) => l.lado === "izq"), hayDer = lados.some((l) => l.lado === "der")
  const largoDe = (pared: number) => Math.max(F + sep + 300, Math.min(6000, o.largos[pared] || 2400))
  const ab = (pared: number) => o.aberturas.filter((a) => a.pared === pared && a.ancho > 0)
  // ¿un gabinete alto de a..b (en "desde") choca con una ventana?
  const conVentana = (pared: number) => (a: number, b: number) => ab(pared).some((v) => v.tipo === "ventana" && v.desde < b - 5 && v.desde + v.ancho > a + 5 && v.sobrePiso + v.alto > o.alturaAltos && v.sobrePiso < o.alturaAltos + o.altoAltos)
  const puertas = (pared: number) => ab(pared).filter((p) => p.tipo === "puerta").map((p) => [p.desde - 30, p.desde + p.ancho + 30] as [number, number])
  const ancho = (ms: Modulo[]) => ms.reduce((t, m) => t + m.ancho, 0)
  const ciego = F + gF + sep + 40 // panel ciego del esquinero: lo que tapa el otro tramo y un poco para abrir la puerta
  const anchoEsq = Math.min(1200, Math.round((ciego + 450) / 10) * 10)

  // arma la secuencia de módulos de una pared entre "desde" s0 y s1, saltando puertas
  const secuencia = (pared: number, s0: number, s1: number, extra: { fregadero?: number; columnaAl?: "inicio" | "fin"; bloque?: Modulo[] }): Modulo[] => {
    const ven = conVentana(pared)
    // tramos libres
    let libres: [number, number][] = [[s0, s1]]
    for (const [a, b] of puertas(pared)) libres = libres.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : ([[x, Math.max(x, a)], [Math.min(y, b), y]] as [number, number][]).filter(([p, q]) => q - p > 0.5)))
    const ms: Modulo[] = []
    let x = s0
    const hueco = (hasta: number) => {
      if (hasta - x > 0.5) ms.push({ tipo: "hueco", ancho: Math.round((hasta - x) * 10) / 10 })
      x = hasta
    }
    libres.forEach(([a, b], k) => {
      hueco(a)
      let ini = a, fin = b
      const pre: Modulo[] = [], post: Modulo[] = []
      // columna y refri en el extremo libre, sólo si dejan lugar al fregadero
      const resto = (extra.fregadero !== undefined ? 800 : 0) + 300
      const sumar = (b: Modulo[]) => b.reduce((t, m) => t + m.ancho, 0)
      let bloque = extra.bloque || [{ tipo: "columna" as TipoModulo, ancho: 600 }]
      // si no cabe todo, primero se queda el refri
      if (fin - ini < sumar(bloque) + resto) bloque = bloque.filter((m) => m.tipo === "refri")
      if (fin - ini < sumar(bloque) + resto) bloque = []
      const anchoB = sumar(bloque)
      const minimo = anchoB + resto
      if (bloque.length && extra.columnaAl === "inicio" && k === 0 && fin - ini >= minimo) {
        pre.push(...[...bloque].reverse())
        ini += anchoB
      }
      if (bloque.length && extra.columnaAl === "fin" && k === libres.length - 1 && fin - ini >= minimo) {
        post.unshift(...bloque)
        fin -= anchoB
      }
      ms.push(...pre)
      x = ini
      // el fregadero va bajo la ventana; si no cabe ahí, lo más cerca que se pueda
      const f = extra.fregadero !== undefined && fin - ini >= 800 ? Math.max(ini + 400, Math.min(fin - 400, extra.fregadero)) : undefined
      if (f !== undefined) {
        // fregadero de 800 centrado en f (bajo la ventana), cajonera junto si cabe
        const fa = Math.round((f - 400) * 10) / 10
        ms.push(...repartir(fa - x, ven, x))
        x = fa
        ms.push({ tipo: "fregadero", ancho: 800, sinAlto: ven(fa, fa + 800) || undefined })
        x = fa + 800
        if (fin - x >= 600 + 300) {
          ms.push({ tipo: "cajonera", ancho: 600, sinAlto: ven(x, x + 600) || undefined })
          x += 600
        }
        extra.fregadero = undefined
      }
      ms.push(...repartir(fin - x, ven, x))
      x = fin
      ms.push(...post)
      x = b
    })
    hueco(s1)
    return ms
  }

  // ---- pared A (fondo) ----
  const ventanaA = ab(0).find((v) => v.tipo === "ventana")
  let ini = 0, fin = LA
  const msA: Modulo[] = []
  const finA: Modulo[] = []
  if (hayIzq) {
    msA.push({ tipo: "esquina", ancho: anchoEsq, ciegoLado: "izq", ciego, sinAlto: conVentana(0)(0, anchoEsq) || undefined })
    ini = anchoEsq
  }
  if (hayDer) {
    finA.push({ tipo: "esquina", ancho: anchoEsq, ciegoLado: "der", ciego, sinAlto: conVentana(0)(LA - anchoEsq, LA) || undefined })
    fin = LA - anchoEsq
  }
  const fregaderoEnA = ventanaA ? ventanaA.desde + ventanaA.ancho / 2 : (ini + fin) / 2
  // columna (alacena) y refri: juntos en el extremo libre de la cocina
  const bloque: Modulo[] = [...(o.conColumna ? [{ tipo: "columna" as TipoModulo, ancho: 600 }] : []), ...(o.refri ? [{ tipo: "refri" as TipoModulo, ancho: 900, sinAlto: true }] : [])]
  const bloqueEnA = bloque.length && (o.forma === "recta" || o.forma === "L") ? (o.forma === "L" && o.ladoL === "der" ? "inicio" : "fin") : undefined
  msA.push(...secuencia(0, ini, fin, { fregadero: fregaderoEnA, columnaAl: bloqueEnA, bloque }), ...finA)
  if (!msA.some((m) => m.tipo === "fregadero")) avisos.push("No cupo el fregadero en la pared del fondo: agrégalo a mano o mueve la ventana o la puerta.")

  type Tramo = { nombre: string; modulos: Modulo[]; giro: number; dx: number; dy: number; conAltos: boolean; largo: number }
  const tramos: Tramo[] = [{ nombre: "Pared A", modulos: msA, giro: 0, dx: 0, dy: 0, conAltos: o.conAltos, largo: LA }]
  for (const l of lados) {
    const LB = largoDe(l.pared)
    const s0 = F + sep // desde la esquina: aquí empieza el primer gabinete del lado
    const columna = bloque.length && o.forma === "U" && l.lado === "der" ? "fin" : undefined
    const seq = secuencia(l.pared, s0, LB, { columnaAl: columna, bloque })
    const largo = ancho(seq)
    if (l.lado === "izq") {
      // en el tramo, X crece hacia la esquina: la secuencia (que va desde la esquina) se invierte
      tramos.push({ nombre: "Pared izquierda", modulos: [...seq].reverse(), giro: Math.PI / 2, dx: F, dy: -sep - largo, conAltos: o.conAltos, largo })
    } else tramos.push({ nombre: "Pared derecha", modulos: seq, giro: -Math.PI / 2, dx: LA - F, dy: -sep, conAltos: o.conAltos, largo })
  }
  if (o.isla && o.isla.largo >= 600) {
    // entre los tramos de los lados, con pasillo de 800 a cada lado
    const libre = LA - (hayIzq ? F + gF + 800 : 0) - (hayDer ? F + gF + 800 : 0)
    const L = Math.floor(Math.min(3600, o.isla.largo, libre) / 10) * 10
    if (L < o.isla.largo) avisos.push(L >= 600 ? `La isla se acortó a ${L} mm para dejar pasillo de 800 mm.` : "La isla no cabe: el cuarto es muy angosto.")
  }
  if (o.isla && o.isla.largo >= 600) {
    const libre = LA - (hayIzq ? F + gF + 800 : 0) - (hayDer ? F + gF + 800 : 0)
    const L = Math.floor(Math.min(3600, o.isla.largo, libre) / 10) * 10
    const x0Isla = (hayIzq ? F + gF + 800 : 0) + (libre - L) / 2
    const seq = L >= 600 ? repartir(L, () => false, 0) : []
    // la isla da su frente a la pared A: girada 180°
    const yFrente = -gF - Math.max(800, o.isla.distancia) - gF
    if (seq.length) tramos.push({ nombre: "Isla", modulos: seq, giro: Math.PI, dx: x0Isla + L, dy: yFrente, conAltos: false, largo: L })
  }

  if (o.refri && !tramos.some((t) => t.modulos.some((m) => m.tipo === "refri"))) avisos.push("No cupo el refrigerador: hazle lugar con un módulo «Refrigerador».")
  // ---- estufa: en un lado (si hay) o en la pared A, lejos del fregadero; lavavajillas junto al fregadero ----
  if (o.estufa && o.estufa !== "ninguna") {
    const orden = [...tramos.slice(1).filter((t) => t.nombre !== "Isla"), tramos[0]]
    let puesta = false
    for (const tr of orden) {
      const cands = tr.modulos.map((m, i) => ({ m, i })).filter(({ m }) => m.tipo === "puertas" && m.ancho >= (o.estufa === "libre" ? 700 : 550) && m.ancho <= (o.estufa === "libre" ? 950 : 1200))
      if (!cands.length) continue
      const iF = tr.modulos.findIndex((m) => m.tipo === "fregadero")
      const c = iF >= 0 ? cands.sort((a, b) => Math.abs(b.i - iF) - Math.abs(a.i - iF))[0] : cands[Math.floor(cands.length / 2)]
      tr.modulos[c.i] = { ...c.m, tipo: o.estufa === "libre" ? "estufa" : "parrilla", sinAlto: true }
      puesta = true
      break
    }
    if (!puesta) avisos.push("No hubo lugar para la estufa: ponla a mano con un módulo de parrilla o estufa.")
  }
  if (o.lavavajillas) {
    const tr = tramos[0]
    const i = tr.modulos.findIndex((m) => m.tipo === "cajonera" && m.ancho >= 600)
    if (i >= 0) tr.modulos[i] = { ...tr.modulos[i], tipo: "lavavajillas", ancho: tr.modulos[i].ancho }
    else avisos.push("No hubo lugar para el lavavajillas junto al fregadero.")
  }

  // ---- armar cada tramo y ponerlos uno tras otro para fabricar ----
  const tableros: TableroC[] = []
  const colocacion: Colocacion[] = []
  const aparatos: Aparato[] = []
  let x = 0
  for (const tr of tramos) {
    const c = cocina({ ...o, modulos: tr.modulos, conAltos: tr.conAltos })
    avisos.push(...c.avisos.map((a) => `${tr.nombre}: ${a}`))
    for (const t of c.tableros) tableros.push({ ...t, nombre: `${tr.nombre} · ${t.nombre}`, x0: t.x0 + x, x1: t.x1 + x })
    // los aparatos ya van colocados en el cuarto
    const co = Math.round(Math.cos(tr.giro)), si = Math.round(Math.sin(tr.giro))
    for (const ap of c.aparatos) {
      const pts = [[ap.lo[0], ap.lo[1]], [ap.hi[0], ap.hi[1]]].map(([a, b]) => [tr.dx + a * co - b * si, tr.dy + a * si + b * co])
      aparatos.push({ tipo: ap.tipo, lo: [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), ap.lo[2]], hi: [Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1]), ap.hi[2]] })
    }
    // M = T(dx, dy) · R(giro) · T(-x, 0)
    colocacion.push({ x0: x - 600, x1: x + c.largo + 600, origen: x, giro: tr.giro, dx: tr.dx, dy: tr.dy })
    x += c.largo + 1500
  }

  // ---- muros con sus huecos y vidrios (sólo para verlos) ----
  const muros: CajaAmbiente[] = [], vidrios: CajaAmbiente[] = []
  const e = 100, H = Math.max(2100, o.altoTecho)
  // pared en coordenadas del cuarto: de p0 a p1 sobre una línea, con su lado de atrás
  const muro = (pared: number, largo: number, aCaja: (s0: number, s1: number, z0: number, z1: number) => CajaAmbiente) => {
    const hs = ab(pared).map((a) => ({ ...a, desde: Math.max(0, a.desde), fin: Math.min(largo, a.desde + a.ancho), z0: a.tipo === "puerta" ? 0 : a.sobrePiso, z1: Math.min(H, (a.tipo === "puerta" ? 0 : a.sobrePiso) + a.alto) })).filter((a) => a.fin > a.desde).sort((a, b) => a.desde - b.desde)
    let s = 0
    for (const h of hs) {
      if (h.desde > s) muros.push(aCaja(s, h.desde, 0, H))
      if (h.z0 > 0) muros.push(aCaja(h.desde, h.fin, 0, h.z0))
      if (h.z1 < H) muros.push(aCaja(h.desde, h.fin, h.z1, H))
      if (h.tipo === "ventana") vidrios.push(aCaja(h.desde, h.fin, h.z0, h.z1))
      s = Math.max(s, h.fin)
    }
    if (s < largo) muros.push(aCaja(s, largo, 0, H))
  }
  muro(0, LA, (s0, s1, z0, z1) => ({ lo: [s0, F, z0], hi: [s1, F + e, z1] }))
  for (const l of lados) {
    const LB = largoDe(l.pared)
    if (l.lado === "izq") muro(l.pared, LB, (s0, s1, z0, z1) => ({ lo: [-e, F - s1, z0], hi: [0, F - s0, z1] }))
    else muro(l.pared, LB, (s0, s1, z0, z1) => ({ lo: [LA, F - s1, z0], hi: [LA + e, F - s0, z1] }))
  }
  // esquinas del muro (para que no quede un hueco)
  if (hayIzq) muros.push({ lo: [-e, F, 0], hi: [0, F + e, H] })
  if (hayDer) muros.push({ lo: [LA, F, 0], hi: [LA + e, F + e, H] })
  return { tableros, avisos, colocacion, muros, vidrios, aparatos }
}
