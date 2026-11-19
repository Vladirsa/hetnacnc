// Componentes y materiales de un mueble, encima del motor de uniones (tableros.ts).
//
// Los tableros de estructura (costados, repisas, divisiones, techo, piso…) pasan
// por el motor: uniones, espigas o herrajes. Los demás son componentes que se
// sobreponen o se atornillan y no llevan espigas:
//  - puerta: frente abatible con bisagras de cazoleta (barreno de 35 mm en la
//    puerta y base de la bisagra en el costado) y jaladera opcional.
//  - frente: frente de cajón (se atornilla a la caja del cajón) con jaladera.
//  - cajon: piezas de la caja del cajón (lados, trasera, fondo), que se arman
//    con tornillo y van sobre correderas.
//  - fondo: tapa trasera delgada (3 a 6 mm) clavada o atornillada por detrás.
//  - cubierta: tapa de arriba sobrepuesta, fijada con escuadras por abajo.
// Cada tablero puede tener su material (y grosor); la estructura usa el
// material del mueble. Patas y jaladeras son de catálogo: se compran, se ven en
// el 3D y salen en la lista de compra.

import { aMueble, type P } from "./ensamble"
import { type Barreno, type MuebleTableros, type OpcionesTableros, type PiezaTablero, type Tablero, muebleDeTableros } from "./tableros"

export type Rol = "estructura" | "puerta" | "frente" | "cajon" | "fondo" | "cubierta"
export type Bisagra = "izq" | "der" | "arriba"
export type TableroC = Tablero & { rol?: Rol; material?: string; bisagra?: Bisagra; jaladera?: number; enRanura?: boolean }

export type Material = { id: string; nombre: string; color: string; veta: boolean; grosores: number[]; canto: boolean }
export const MATERIALES: Material[] = [
  { id: "melamina-blanca", nombre: "Melamina blanca", color: "#F2F1EC", veta: false, grosores: [15, 16, 18], canto: true },
  { id: "melamina-gris", nombre: "Melamina gris grafito", color: "#5B6068", veta: false, grosores: [15, 16, 18], canto: true },
  { id: "melamina-roble", nombre: "Melamina roble", color: "#C9A26E", veta: true, grosores: [15, 16, 18], canto: true },
  { id: "melamina-nogal", nombre: "Melamina nogal", color: "#7A5236", veta: true, grosores: [15, 16, 18], canto: true },
  { id: "mdf", nombre: "MDF crudo", color: "#C8A27A", veta: false, grosores: [3, 6, 9, 12, 15, 18, 25], canto: false },
  { id: "mdf-brillo", nombre: "MDF alto brillo blanco", color: "#FFFFFF", veta: false, grosores: [16, 18], canto: true },
  { id: "triplay-pino", nombre: "Triplay de pino", color: "#E2C38F", veta: true, grosores: [6, 9, 12, 15, 18], canto: false },
  { id: "hdf", nombre: "HDF / fibracel", color: "#8B6A4A", veta: false, grosores: [3, 4, 6], canto: false },
  { id: "encino", nombre: "Madera de encino", color: "#B5834E", veta: true, grosores: [19, 25, 32], canto: false },
]
export const materialDe = (id?: string) => MATERIALES.find((m) => m.id === id) || MATERIALES[0]
// material y grosor de inicio de cada componente
export const PREDETERMINADO: Record<Exclude<Rol, "estructura">, { material?: string; grosor?: number }> = {
  puerta: {},
  frente: {},
  cajon: { grosor: 15 },
  fondo: { material: "hdf", grosor: 3 },
  cubierta: { material: "encino", grosor: 25 },
}
export const ROLES: { id: Rol; nombre: string }[] = [
  { id: "estructura", nombre: "Estructura" },
  { id: "puerta", nombre: "Puerta" },
  { id: "frente", nombre: "Frente de cajón" },
  { id: "cajon", nombre: "Caja de cajón" },
  { id: "fondo", nombre: "Fondo" },
  { id: "cubierta", nombre: "Cubierta" },
]

export type OpcionesMueble = OpcionesTableros & { material?: string; patas?: number }
// ranura: canal (para el fondo) en una cara de la pieza, de u0..u1 × v0..v1 y prof de hondo
export type Ranura = { u0: number; v0: number; u1: number; v1: number; prof: number; cara: 0 | 1 }
export type PiezaMueble = PiezaTablero & { rol: Rol; material: string; ranuras: Ranura[] }
// accesorios para el 3D (en mm del mueble)
export type Accesorio = { tipo: "pata"; x: number; y: number; z0: number; z1: number; d: number } | { tipo: "jaladera"; a: [number, number, number]; b: [number, number, number]; sale: [number, number, number] }
export type MuebleCompleto = Omit<MuebleTableros, "piezas" | "tablerosFinales"> & { piezas: PiezaMueble[]; tablerosFinales: TableroC[]; accesorios: Accesorio[]; cantoMetros: number }

type Eje = 0 | 1 | 2
const LO = ["x0", "y0", "z0"] as const
const HI = ["x1", "y1", "z1"] as const
const ejeDelgado = (t: Tablero): Eje => {
  const ext = [t.x1 - t.x0, t.y1 - t.y0, t.z1 - t.z0]
  return ext.indexOf(Math.min(...ext)) as Eje
}
const EJE_U: Record<Eje, Eje> = { 0: 1, 1: 0, 2: 0 }
const EJE_V: Record<Eje, Eje> = { 0: 2, 1: 2, 2: 1 }
const PLANO = { 0: "lateral", 1: "frontal", 2: "horizontal" } as const
const circulo = (cu: number, cv: number, r: number, n = 20): P[] => Array.from({ length: n }, (_, i) => [cu + r * Math.cos((2 * Math.PI * i) / n), cv + r * Math.sin((2 * Math.PI * i) / n)] as P)
const r1 = (v: number) => Math.round(v * 10) / 10
export const esEstructura = (t: TableroC) => !t.rol || t.rol === "estructura"

export function muebleCompleto(todos: TableroC[], o: OpcionesMueble): MuebleCompleto {
  const idxE: number[] = [], idxX: number[] = []
  todos.forEach((t, i) => (esEstructura(t) ? idxE : idxX).push(i))
  const estructura = idxE.map((i) => todos[i])
  const m = muebleDeTableros(estructura, o)
  const matE = materialDe(o.material).id
  const avisos = [...m.avisos]
  const compras = [...m.compras]

  // los componentes siguen la escala de la estructura (de la lectura a lo armado)
  const cajaDe = (ts: Tablero[]) => [0, 1, 2].map((i) => [Math.min(...ts.map((t) => t[LO[i]])), Math.max(...ts.map((t) => t[HI[i]]))])
  const antes = estructura.length ? cajaDe(estructura) : null
  const despues = m.tablerosFinales.length ? cajaDe(m.tablerosFinales) : null
  // sólo cuando se piden medidas totales: si no, los componentes se quedan donde están
  // (que la estructura crezca unos milímetros por el margen de las mortajas no los mueve)
  const escalado = [o.ancho, o.fondo, o.alto].some((v) => v && Number.isFinite(v))
  const llevar = (i: number, v: number) => {
    if (!antes || !despues || !escalado) return v
    const [a0, a1] = antes[i], [b0, b1] = despues[i]
    return a1 - a0 < 1 ? v - a0 + b0 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0)
  }
  const extras: TableroC[] = idxX.map((i) => {
    const t = todos[i]
    const k = ejeDelgado(t)
    const g = t[HI[k]] - t[LO[k]]
    const n: TableroC = { ...t }
    for (const ax of [0, 1, 2] as Eje[]) {
      if (ax === k) {
        // el grosor no se escala: se mueve su centro
        const c = llevar(ax, (t[LO[ax]] + t[HI[ax]]) / 2)
        n[LO[ax]] = r1(c - g / 2)
        n[HI[ax]] = n[LO[ax]] + g
      } else {
        n[LO[ax]] = r1(llevar(ax, t[LO[ax]]))
        n[HI[ax]] = r1(llevar(ax, t[HI[ax]]))
      }
    }
    return n
  })

  // la cubierta se asienta sobre lo más alto de la estructura que tiene debajo
  // (con caja y espiga los costados pueden subir unos milímetros sobre los travesaños)
  for (const t of extras) {
    if (t.rol !== "cubierta") continue
    const g = t.z1 - t.z0
    let tope = -Infinity
    for (const f of m.tablerosFinales) {
      const sobre = f.x1 > t.x0 + 1 && f.x0 < t.x1 - 1 && f.y1 > t.y0 + 1 && f.y0 < t.y1 - 1
      if (sobre && f.z1 <= t.z0 + 60 && f.z1 >= t.z0 - 60) tope = Math.max(tope, f.z1)
    }
    if (Number.isFinite(tope) && tope > t.z0) {
      t.z0 = r1(tope)
      t.z1 = t.z0 + g
    }
  }

  // piezas de estructura: con su material y el índice en la lista completa
  const piezas: PiezaMueble[] = m.piezas.map((p) => ({ ...p, origen: idxE[p.origen] ?? p.origen, rol: "estructura" as Rol, material: matE, barrenos: [...p.barrenos], ranuras: [] }))
  const accesorios: Accesorio[] = []
  let bisagras = 0, jaladeras = 0
  const correderas: number[] = []

  extras.forEach((t, j) => {
    const k = ejeDelgado(t)
    const U = EJE_U[k], V = EJE_V[k]
    const lo = [t.x0, t.y0, t.z0], hi = [t.x1, t.y1, t.z1]
    const g = hi[k] - lo[k]
    const u0 = lo[U], u1 = hi[U], v0 = lo[V], v1 = hi[V]
    const contorno: P[] = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
    const huecos: P[][] = []
    const barrenos: Barreno[] = []
    for (const a of t.aberturas || []) {
      const a0 = u0 + Math.min(a.u0, a.u1), a1 = u0 + Math.max(a.u0, a.u1), b0 = v0 + Math.min(a.v0, a.v1), b1 = v0 + Math.max(a.v0, a.v1)
      if (a0 >= u0 + 10 && a1 <= u1 - 10 && b0 >= v0 + 10 && b1 <= v1 - 10) huecos.push([[a0, b0], [a1, b0], [a1, b1], [a0, b1]])
    }
    const pz: PiezaMueble = {
      nombre: t.nombre,
      plano: PLANO[k],
      contorno,
      huecos,
      desfase: lo[k],
      grosor: g,
      origen: idxX[j],
      indice: piezas.length + j,
      barrenos,
      cantos: [],
      ranuras: [],
      rol: t.rol || "puerta",
      material: materialDe(t.material || PREDETERMINADO[(t.rol || "puerta") as Exclude<Rol, "estructura">]?.material || matE).id,
    }
    const enMueble = (u: number, v: number, w: number) => aMueble(pz, u, v, w)
    // ---- puerta: bisagras ----
    if (t.rol === "puerta" && k === 1) {
      const lado = t.bisagra || "izq"
      const vertical = lado !== "arriba"
      const largo = vertical ? v1 - v0 : u1 - u0
      const n = largo <= 900 ? 2 : largo <= 1600 ? 3 : largo <= 2000 ? 4 : 5
      const pos = Array.from({ length: n }, (_, i) => 100 + ((largo - 200) * i) / (n - 1))
      // la cara de atrás de la puerta (hacia el mueble) es la de w = grosor
      const atras: 0 | 1 = 1
      for (const s of pos) {
        const cu = vertical ? (lado === "izq" ? u0 + 21.5 : u1 - 21.5) : u0 + s
        const cv = vertical ? v0 + s : v1 - 21.5
        barrenos.push({ u: cu, v: cv, d: 35, prof: Math.min(12.5, g - 3), cara: atras, tipo: "cazoleta" })
        bisagras++
        // base de la bisagra en el costado de ese lado: dos barrenos de 5 mm a 37 mm de la orilla del frente
        if (vertical) {
          const xBorde = lado === "izq" ? u0 : u1
          const zc = cv
          const yFrente = hi[1]
          let mejor: { p: PiezaMueble; d: number } | null = null
          for (const p of piezas) {
            if (p.plano !== "lateral") continue
            const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
            if (zc < Math.min(...vs) + 30 || zc > Math.max(...vs) - 30 || Math.min(...us) > yFrente + 5) continue
            const xc = p.desfase + p.grosor / 2
            const d = Math.abs(xc - xBorde)
            if (d < 30 && (!mejor || d < mejor.d)) mejor = { p, d }
          }
          if (mejor) {
            const p = mejor.p
            // la base va en la cara de adentro del costado (hacia el hueco que cierra la puerta)
            const centroPuerta = (u0 + u1) / 2
            const cara: 0 | 1 = centroPuerta > p.desfase + p.grosor / 2 ? 1 : 0
            const yMin = Math.min(...p.contorno.map((q) => q[0]))
            for (const dz of [-16, 16]) p.barrenos.push({ u: yMin + 37, v: zc + dz, d: 5, prof: 12, cara, tipo: "base-bisagra" })
          }
        }
      }
    }
    // ---- jaladera (puerta o frente): dos barrenos pasados de 5 mm ----
    if ((t.rol === "puerta" || t.rol === "frente") && t.jaladera && t.jaladera > 0 && k === 1) {
      const sep = t.jaladera
      const lado = t.bisagra || "izq"
      let a: [number, number], b: [number, number]
      if (t.rol === "frente" || lado === "arriba") {
        const cu = (u0 + u1) / 2, cv = t.rol === "frente" ? (v0 + v1) / 2 : v0 + 50
        a = [cu - sep / 2, cv]
        b = [cu + sep / 2, cv]
      } else {
        const cu = lado === "izq" ? u1 - 40 : u0 + 40
        const cv = (v0 + v1) / 2
        a = [cu, cv - sep / 2]
        b = [cu, cv + sep / 2]
      }
      if (Math.max(a[0], b[0]) < u1 - 10 && Math.min(a[0], b[0]) > u0 + 10 && Math.max(a[1], b[1]) < v1 - 10 && Math.min(a[1], b[1]) > v0 + 10) {
        huecos.push(circulo(a[0], a[1], 2.5), circulo(b[0], b[1], 2.5))
        jaladeras++
        const pa = enMueble(a[0], a[1], 0), pb = enMueble(b[0], b[1], 0)
        accesorios.push({ tipo: "jaladera", a: pa, b: pb, sale: [0, -32, 0] })
      }
    }
    if (t.rol === "cajon" && k === 0) correderas.push(Math.round(hi[1] - lo[1]))
    // fondo en ranura: canal de 4 mm × 8 mm en cada pieza de estructura donde entra
    if (t.rol === "fondo" && t.enRanura) {
      const anchoR = 4, profR = 8
      const c = (lo[k] + hi[k]) / 2
      const f0 = [...lo], f1 = [...hi]
      f0[k] = c - anchoR / 2
      f1[k] = c + anchoR / 2
      m.tablerosFinales.forEach((tf, i) => {
        const p = piezas[i]
        if (!p || p.rol !== "estructura") return
        const kp = ejeDelgado(tf)
        if (kp === k) return
        const plo = [tf.x0, tf.y0, tf.z0], phi = [tf.x1, tf.y1, tf.z1]
        const o0 = [0, 1, 2].map((a) => Math.max(f0[a], plo[a])), o1 = [0, 1, 2].map((a) => Math.min(f1[a], phi[a]))
        if (o0.some((v, a) => o1[a] - v <= 0.2)) return
        const U = EJE_U[kp], V = EJE_V[kp]
        const cara: 0 | 1 = (lo[kp] + hi[kp]) / 2 > (plo[kp] + phi[kp]) / 2 ? 1 : 0
        p.ranuras.push({ u0: o0[U], v0: o0[V], u1: o1[U], v1: o1[V], prof: profR, cara })
      })
    }
    piezas.push(pz)
  })

  // ---- patas: 4 (o 6) bajo la huella del mueble ----
  const patas = Math.max(0, o.patas || 0)
  if (patas > 0 && piezas.length) {
    const xs = piezas.flatMap((p) => p.contorno.map(([u, v]) => aMueble(p, u, v, 0)))
    const est = piezas.filter((p) => p.rol === "estructura")
    const base = (est.length ? est : piezas).flatMap((p) => p.contorno.flatMap(([u, v]) => [aMueble(p, u, v, 0), aMueble(p, u, v, p.grosor)]))
    const x0 = Math.min(...base.map((q) => q[0])), x1 = Math.max(...base.map((q) => q[0]))
    const y0 = Math.min(...base.map((q) => q[1])), y1 = Math.max(...base.map((q) => q[1]))
    const z0 = Math.min(...xs.map((q) => q[2]), ...base.map((q) => q[2]))
    const dentro = 50
    const columnas = x1 - x0 > 1200 ? [x0 + dentro, (x0 + x1) / 2, x1 - dentro] : [x0 + dentro, x1 - dentro]
    for (const x of columnas) for (const y of [y0 + dentro, y1 - dentro]) accesorios.push({ tipo: "pata", x, y, z0: z0 - patas, z1: z0, d: 32 })
    compras.push({ nombre: `Pata niveladora de ${patas} mm`, cantidad: columnas.length * 2, nota: "Se atornilla bajo el piso del mueble." })
  }
  if (bisagras) compras.push({ nombre: "Bisagra de cazoleta 35 mm (sobrepuesta)", cantidad: bisagras, nota: "Con su base y tornillos." })
  if (jaladeras) compras.push({ nombre: "Jaladera", cantidad: jaladeras, nota: `Con tornillo de 5 mm${extras.some((t) => t.jaladera) ? `, centros a ${[...new Set(extras.filter((t) => t.jaladera).map((t) => t.jaladera))].join(" / ")} mm` : ""}.` })
  // correderas: un par por cajón (cada caja tiene dos lados)
  if (correderas.length) {
    const porLargo = new Map<number, number>()
    for (const l of correderas) {
      const std = [250, 300, 350, 400, 450, 500, 550].reduce((b, s) => (s <= l + 5 ? s : b), 250)
      porLargo.set(std, (porLargo.get(std) || 0) + 1)
    }
    for (const [l, n] of porLargo) compras.push({ nombre: `Corredera telescópica de ${l} mm (par)`, cantidad: Math.max(1, Math.round(n / 2)), nota: "Holgura de 12.7 mm por lado." })
  }
  if (extras.some((t) => t.rol === "fondo" && !t.enRanura)) compras.push({ nombre: "Clavo o grapa para fondo", cantidad: 1, nota: "Una caja; también se puede atornillar." })
  if (extras.some((t) => t.rol === "cubierta")) compras.push({ nombre: "Escuadra de fijación para cubierta", cantidad: 4 + 2 * Math.max(0, Math.floor((m.medidas.ancho - 600) / 600)), nota: "Se atornilla por abajo." })
  if (extras.some((t) => t.rol === "cajon")) compras.push({ nombre: "Tornillo para madera 4 × 40", cantidad: 1, nota: "Una caja: armado de los cajones y frentes." })

  // canto: orillas del frente de la estructura y todo el contorno de puertas y frentes (en materiales que se cantean)
  let canto = 0
  const yFrente = Math.min(...piezas.filter((p) => p.rol === "estructura").flatMap((p) => p.contorno.map(([u, v]) => aMueble(p, u, v, 0)[1])), Infinity)
  for (const p of piezas) {
    if (!materialDe(p.material).canto) continue
    const us = p.contorno.map((q) => q[0]), vs = p.contorno.map((q) => q[1])
    const a = Math.max(...us) - Math.min(...us), b = Math.max(...vs) - Math.min(...vs)
    if (p.rol === "puerta" || p.rol === "frente" || p.rol === "cubierta") canto += 2 * (a + b)
    else if (p.rol === "estructura") {
      // la orilla del frente: lateral (u = Y) y horizontal (v = Y) tocan el frente con su lado de largo b o a
      if (p.plano === "lateral" && Math.abs(Math.min(...us) - yFrente) < 25) canto += b
      if (p.plano === "horizontal" && Math.abs(Math.min(...vs) - yFrente) < 25) canto += a
    }
  }
  if (canto > 0) compras.push({ nombre: "Canto de PVC (enchapado)", cantidad: Math.ceil((canto / 1000) * 1.1), nota: "Metros, con 10 % extra. Del color del material." })

  // medidas totales con componentes y patas
  const pts = piezas.flatMap((p) => p.contorno.flatMap(([u, v]) => [aMueble(p, u, v, 0), aMueble(p, u, v, p.grosor)]))
  const lo3 = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))), hi3 = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])))
  if (patas > 0) lo3[2] -= patas
  const medidas = pts.length ? { ancho: Math.round(hi3[0] - lo3[0]), fondo: Math.round(hi3[1] - lo3[1]), alto: Math.round(hi3[2] - lo3[2]) } : m.medidas

  return {
    ...m,
    piezas,
    compras,
    avisos,
    medidas,
    accesorios,
    cantoMetros: Math.round(canto / 100) / 10,
    tablerosFinales: [...m.tablerosFinales.map((t) => ({ ...t, rol: "estructura" as Rol })), ...extras],
  }
}

// ---------- generadores de componentes para el editor ----------
type Pt = [number, number, number]
const lo = (t: Tablero, i: Eje) => t[LO[i]]
const hi = (t: Tablero, i: Eje) => t[HI[i]]

// El hueco de la estructura alrededor de un punto: caras de los tableros que lo
// encierran y si cada lado es una orilla del mueble (para sobreponer la puerta completa o a media).
export function huecoEn(ts: TableroC[], p: Pt | null) {
  const est = ts.filter(esEstructura)
  const todo = est.length ? est : ts
  const caja = [0, 1, 2].map((i) => [Math.min(...todo.map((t) => lo(t, i as Eje))), Math.max(...todo.map((t) => hi(t, i as Eje)))])
  const q: Pt = p || [(caja[0][0] + caja[0][1]) / 2, (caja[1][0] + caja[1][1]) / 2, (caja[2][0] + caja[2][1]) / 2]
  const tope = (k: Eje, hacia: -1 | 1) => {
    let val = hacia < 0 ? caja[k][0] : caja[k][1]
    let grosor = 0
    let orilla = true
    for (const t of est) {
      if (ejeDelgado(t) !== k) continue
      const otros = ([0, 1, 2] as Eje[]).filter((i) => i !== k)
      if (!otros.every((i) => lo(t, i) - 1 <= q[i] && q[i] <= hi(t, i) + 1)) continue
      if (hacia < 0 && hi(t, k) <= q[k] + 0.5 && hi(t, k) >= val - 0.5) {
        val = hi(t, k)
        grosor = hi(t, k) - lo(t, k)
        orilla = lo(t, k) <= caja[k][0] + 1
      }
      if (hacia > 0 && lo(t, k) >= q[k] - 0.5 && lo(t, k) <= val + 0.5) {
        val = lo(t, k)
        grosor = hi(t, k) - lo(t, k)
        orilla = hi(t, k) >= caja[k][1] - 1
      }
    }
    return { val, grosor, orilla }
  }
  return { x0: tope(0, -1), x1: tope(0, 1), y0: caja[1][0], y1: tope(1, 1).val, z0: tope(2, -1), z1: tope(2, 1), caja }
}

const nombreLibre = (ts: Tablero[], base: string) => {
  const usados = new Set(ts.map((t) => t.nombre))
  if (!usados.has(base)) return base
  for (let n = 2; ; n++) if (!usados.has(`${base} ${n}`)) return `${base} ${n}`
}

export type TipoComponente = "puerta" | "puertas" | "cajon" | "fondo" | "cubierta"
export function agregarComponente(ts: TableroC[], tipo: TipoComponente, punto: Pt | null, gEstructura: number): { tableros: TableroC[]; indice: number } {
  const h = huecoEn(ts, punto)
  const holgura = 2 // entre puertas y orillas
  // cuánto se sobrepone la puerta: completa en las orillas del mueble, a media en divisiones
  const sobre = (b: { grosor: number; orilla: boolean }) => (b.grosor ? (b.orilla ? b.grosor - holgura / 2 : b.grosor / 2 - holgura / 2) : 0)
  const nuevos: TableroC[] = []
  const gPuerta = gEstructura
  if (tipo === "puerta" || tipo === "puertas") {
    const x0 = h.x0.val - sobre(h.x0), x1 = h.x1.val + sobre(h.x1)
    const z0 = h.z0.val - sobre(h.z0), z1 = h.z1.val + sobre(h.z1)
    const y1 = h.y0, y0 = y1 - gPuerta
    if (tipo === "puertas" || x1 - x0 > 600) {
      const medio = (x0 + x1) / 2
      nuevos.push({ nombre: nombreLibre(ts, "Puerta izquierda"), plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0, x1: medio - holgura / 2, y0, y1, z0, z1 })
      nuevos.push({ nombre: nombreLibre(ts, "Puerta derecha"), plano: "frontal", rol: "puerta", bisagra: "der", jaladera: 128, x0: medio + holgura / 2, x1, y0, y1, z0, z1 })
    } else nuevos.push({ nombre: nombreLibre(ts, "Puerta"), plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0, x1, y0, y1, z0, z1 })
  } else if (tipo === "cajon") {
    const x0 = h.x0.val, x1 = h.x1.val, z0 = h.z0.val, z1 = h.z1.val
    const fondoHueco = h.y1 - h.y0
    // frente sobrepuesto
    nuevos.push({ nombre: nombreLibre(ts, "Frente de cajón"), plano: "frontal", rol: "frente", jaladera: 128, x0: x0 - sobre(h.x0), x1: x1 + sobre(h.x1), y0: h.y0 - gPuerta, y1: h.y0, z0: z0 - sobre(h.z0), z1: z1 + sobre(h.z1) })
    // caja: 12.7 mm de holgura por lado para la corredera
    const g = PREDETERMINADO.cajon.grosor || 15
    const largo = [550, 500, 450, 400, 350, 300, 250].find((l) => l <= fondoHueco - 20) || Math.max(150, fondoHueco - 20)
    const bx0 = x0 + 12.7, bx1 = x1 - 12.7
    const bz0 = z0 + 15, bz1 = Math.max(bz0 + 60, z1 - 25)
    const by0 = h.y0, by1 = h.y0 + largo
    const base = nombreLibre(ts, "Cajón")
    nuevos.push({ nombre: `${base}: lado izquierdo`, plano: "lateral", rol: "cajon", x0: bx0, x1: bx0 + g, y0: by0, y1: by1, z0: bz0, z1: bz1 })
    nuevos.push({ nombre: `${base}: lado derecho`, plano: "lateral", rol: "cajon", x0: bx1 - g, x1: bx1, y0: by0, y1: by1, z0: bz0, z1: bz1 })
    nuevos.push({ nombre: `${base}: frente interior`, plano: "frontal", rol: "cajon", x0: bx0 + g, x1: bx1 - g, y0: by0, y1: by0 + g, z0: bz0, z1: bz1 })
    nuevos.push({ nombre: `${base}: trasera`, plano: "frontal", rol: "cajon", x0: bx0 + g, x1: bx1 - g, y0: by1 - g, y1: by1, z0: bz0, z1: bz1 })
    nuevos.push({ nombre: `${base}: fondo`, plano: "horizontal", rol: "cajon", material: "hdf", x0: bx0, x1: bx1, y0: by0, y1: by1, z0: bz0 - 3, z1: bz0 })
  } else if (tipo === "fondo") {
    const [cx, , cz] = h.caja
    const g = PREDETERMINADO.fondo.grosor || 3
    nuevos.push({ nombre: nombreLibre(ts, "Fondo"), plano: "frontal", rol: "fondo", material: PREDETERMINADO.fondo.material, x0: cx[0], x1: cx[1], y0: h.caja[1][1], y1: h.caja[1][1] + g, z0: cz[0], z1: cz[1] })
  } else {
    const [cx, cy, cz] = h.caja
    const g = PREDETERMINADO.cubierta.grosor || 25
    nuevos.push({ nombre: nombreLibre(ts, "Cubierta"), plano: "horizontal", rol: "cubierta", material: PREDETERMINADO.cubierta.material, x0: cx[0] - 15, x1: cx[1] + 15, y0: cy[0] - 25, y1: cy[1], z0: cz[1], z1: cz[1] + g })
  }
  return { tableros: [...ts, ...nuevos], indice: ts.length }
}
