// Asistente de gabinete de cocina o closet: de unas cuantas opciones sale la
// lista de tableros completa (estructura y componentes), lista para el motor de
// uniones (tableros.ts) y de componentes (componentes.ts), y editable en 3D.
//
// Ejes: X ancho, Y fondo (0 = frente), Z alto (0 = piso). Medidas en mm.

import type { TableroC } from "./componentes"

export type TipoGabinete = "bajo" | "alto" | "columna"
export type Techo = "completo" | "travesanos" | "sin"
export type FondoGabinete = "ranura" | "clavado" | "sin"
export type Frente = "nada" | "puerta" | "puertas" | "cajones" | "cajon-puertas" | "esquinero" | "abatible"

export type OpcionesGabinete = {
  tipo: TipoGabinete
  ancho: number
  alto: number
  fondo: number
  grosor: number // estructura
  techo: Techo
  fondoTipo: FondoGabinete
  zoclo: number // alto del zoclo (0 = sin zoclo)
  zocloRemetido: number // cuánto se mete el zoclo desde el frente
  repisas: number
  frente: Frente
  cajones: number
  gFrente: number // grosor de puertas y frentes
  repisasMovibles?: boolean // sobre pines (sistema 32) en vez de fijas
  // esquinero: de qué lado queda el panel ciego (donde llega el otro tramo) y cuánto mide
  ciegoLado?: "izq" | "der"
  ciego?: number
}

export const GABINETE_INICIO: Record<TipoGabinete, Omit<OpcionesGabinete, "grosor" | "gFrente">> = {
  bajo: { tipo: "bajo", ancho: 800, alto: 720, fondo: 560, techo: "travesanos", fondoTipo: "ranura", zoclo: 100, zocloRemetido: 50, repisas: 1, frente: "puertas", cajones: 3 },
  alto: { tipo: "alto", ancho: 800, alto: 720, fondo: 320, techo: "completo", fondoTipo: "ranura", zoclo: 0, zocloRemetido: 0, repisas: 1, frente: "puertas", cajones: 2 },
  columna: { tipo: "columna", ancho: 600, alto: 2100, fondo: 560, techo: "completo", fondoTipo: "ranura", zoclo: 100, zocloRemetido: 50, repisas: 4, frente: "puertas", cajones: 4 },
}

// ranura del fondo: a 11 mm de la orilla de atrás, 4 mm de ancho, 8 mm de hondo (fondo de 3 mm)
export const RANURA = { desde: 11, ancho: 4, prof: 8, gFondo: 3 }

export function gabinete(o0: OpcionesGabinete): { tableros: TableroC[]; avisos: string[] } {
  const avisos: string[] = []
  const acotar = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a)
  const o = { ...o0 }
  o.grosor = acotar(o.grosor, 9, 30)
  o.gFrente = acotar(o.gFrente || o.grosor, 9, 30)
  o.ancho = acotar(o.ancho, 150, 1200)
  o.alto = acotar(o.alto, 200, 2600)
  o.fondo = acotar(o.fondo, 150, 900)
  o.zoclo = o.tipo === "alto" ? 0 : acotar(o.zoclo, 0, 250)
  o.zocloRemetido = acotar(o.zocloRemetido, 0, 120)
  o.repisas = Math.round(acotar(o.repisas, 0, 12))
  o.cajones = Math.round(acotar(o.cajones, 1, 8))
  if (o0.ancho > 1200) avisos.push("Un gabinete de más de 1200 mm de ancho se pandea: divídelo en dos.")
  const e = o.grosor, A = o.ancho, H = o.alto, F = o.fondo
  const t: TableroC[] = []
  const xi0 = e, xi1 = A - e // caras de adentro de los costados
  // costados: del piso hasta arriba (el zoclo va entre ellos)
  t.push({ nombre: "Costado izquierdo", plano: "lateral", rol: "estructura", x0: 0, x1: e, y0: 0, y1: F, z0: 0, z1: H })
  t.push({ nombre: "Costado derecho", plano: "lateral", rol: "estructura", x0: A - e, x1: A, y0: 0, y1: F, z0: 0, z1: H })
  // piso
  const zPiso = o.zoclo > 0 ? o.zoclo : 0
  t.push({ nombre: "Piso", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: 0, y1: F, z0: zPiso, z1: zPiso + e })
  // zoclo al frente (remetido) y atrás
  if (o.zoclo > 0) {
    t.push({ nombre: "Zoclo", plano: "frontal", rol: "estructura", x0: xi0, x1: xi1, y0: o.zocloRemetido, y1: o.zocloRemetido + e, z0: 0, z1: zPiso })
    t.push({ nombre: "Zoclo trasero", plano: "frontal", rol: "estructura", x0: xi0, x1: xi1, y0: F - 40 - e, y1: F - 40, z0: 0, z1: zPiso })
  }
  // fondo en ranura: su plano va a 11 mm de la orilla de atrás
  const yFondo0 = F - RANURA.desde - RANURA.ancho + (RANURA.ancho - RANURA.gFondo) / 2
  // techo
  let zTecho = H
  if (o.techo === "completo") {
    t.push({ nombre: "Techo", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: 0, y1: F, z0: H - e, z1: H })
    zTecho = H - e
  } else if (o.techo === "travesanos") {
    const anchoT = Math.min(100, F / 4)
    t.push({ nombre: "Travesaño del frente", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: 0, y1: anchoT, z0: H - e, z1: H })
    const yT1 = o.fondoTipo === "ranura" ? yFondo0 - 1 : F
    t.push({ nombre: "Travesaño de atrás", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: yT1 - anchoT, y1: yT1, z0: H - e, z1: H })
  }
  // repisas fijas repartidas en el hueco
  const zInt0 = zPiso + e, zInt1 = o.techo === "sin" ? H : zTecho
  const fondoRepisa = Math.max(100, (o.fondoTipo === "ranura" ? yFondo0 : F) - 5)
  // cajón arriba y puertas abajo: un separador fijo bajo el cajón
  const altoCajonArriba = 150
  const zSep = zInt1 - altoCajonArriba - e
  if (o.frente === "cajon-puertas") t.push({ nombre: "Separador del cajón", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: 0, y1: Math.max(100, (o.fondoTipo === "ranura" ? F - RANURA.desde - RANURA.ancho : F) - 5), z0: zSep, z1: zSep + e })
  const zRep1 = o.frente === "cajon-puertas" ? zSep : zInt1
  if (o.frente !== "cajones")
    for (let i = 1; i <= o.repisas; i++) {
      const z = zInt0 + ((zRep1 - zInt0) * i) / (o.repisas + 1) - e / 2
      t.push(
        o.repisasMovibles
          ? { nombre: o.repisas > 1 ? `Repisa movible ${i}` : "Repisa movible", plano: "horizontal", rol: "repisa", x0: xi0 + 1, x1: xi1 - 1, y0: 0, y1: fondoRepisa - 5, z0: z, z1: z + e }
          : { nombre: o.repisas > 1 ? `Repisa ${i}` : "Repisa", plano: "horizontal", rol: "estructura", x0: xi0, x1: xi1, y0: 0, y1: fondoRepisa, z0: z, z1: z + e },
      )
    }
  // fondo
  if (o.fondoTipo === "ranura") {
    const meter = RANURA.prof - 1 // se mete 7 mm en cada ranura
    t.push({ nombre: "Fondo", plano: "frontal", rol: "fondo", material: "hdf", x0: xi0 - meter, x1: xi1 + meter, y0: yFondo0, y1: yFondo0 + RANURA.gFondo, z0: zPiso + e - meter, z1: o.techo === "completo" ? zTecho + meter : H - 1, enRanura: true })
  } else if (o.fondoTipo === "clavado") {
    t.push({ nombre: "Fondo", plano: "frontal", rol: "fondo", material: "hdf", x0: 0, x1: A, y0: F, y1: F + RANURA.gFondo, z0: zPiso, z1: H })
  }
  // frentes: sobrepuestos sobre los costados y el piso/techo (holgura de 2 mm a las orillas, 3 mm entre frentes)
  const h = 2
  const fx0 = h / 2, fx1 = A - h / 2
  const fz0 = zPiso + h / 2, fz1 = H - h / 2
  const yF1 = 0, yF0 = -o.gFrente
  if (o.frente === "puerta" || o.frente === "puertas") {
    if (o.frente === "puertas" && A >= 400) {
      const m = A / 2
      t.push({ nombre: "Puerta izquierda", plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0: fx0, x1: m - 1.5, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
      t.push({ nombre: "Puerta derecha", plano: "frontal", rol: "puerta", bisagra: "der", jaladera: 128, x0: m + 1.5, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
    } else t.push({ nombre: "Puerta", plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0: fx0, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
  } else if (o.frente === "abatible") {
    t.push({ nombre: "Puerta abatible", plano: "frontal", rol: "puerta", bisagra: "arriba", jaladera: 128, x0: fx0, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
  } else if (o.frente === "esquinero") {
    // esquinero ciego: la puerta de un lado y un panel fijo donde llega el otro tramo de la cocina
    const anchoPuerta = o.ciego ? Math.max(250, Math.min(600, fx1 - fx0 - o.ciego - 3)) : Math.min(500, Math.max(300, A - 450))
    if (o.ciegoLado === "izq") {
      t.push({ nombre: "Panel ciego", plano: "frontal", rol: "frente", jaladera: 0, x0: fx0, x1: fx1 - anchoPuerta - 3, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
      t.push({ nombre: "Puerta", plano: "frontal", rol: "puerta", bisagra: "der", jaladera: 128, x0: fx1 - anchoPuerta, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
    } else {
      t.push({ nombre: "Puerta", plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0: fx0, x1: fx0 + anchoPuerta, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
      t.push({ nombre: "Panel ciego", plano: "frontal", rol: "frente", jaladera: 0, x0: fx0 + anchoPuerta + 3, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fz1 })
    }
  } else if (o.frente === "cajon-puertas") {
    const fSep = fz1 - altoCajonArriba
    t.push({ nombre: "Cajón: frente", plano: "frontal", rol: "frente", jaladera: 128, x0: fx0, x1: fx1, y0: yF0, y1: yF1, z0: fSep + 1.5, z1: fz1 })
    if (A >= 500) {
      const mm = A / 2
      t.push({ nombre: "Puerta izquierda", plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0: fx0, x1: mm - 1.5, y0: yF0, y1: yF1, z0: fz0, z1: fSep - 1.5 })
      t.push({ nombre: "Puerta derecha", plano: "frontal", rol: "puerta", bisagra: "der", jaladera: 128, x0: mm + 1.5, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fSep - 1.5 })
    } else t.push({ nombre: "Puerta", plano: "frontal", rol: "puerta", bisagra: "izq", jaladera: 128, x0: fx0, x1: fx1, y0: yF0, y1: yF1, z0: fz0, z1: fSep - 1.5 })
    // caja del cajón entre el separador y el techo
    const gC = 15
    const largo = [550, 500, 450, 400, 350, 300, 250].find((l) => l <= (o.fondoTipo === "ranura" ? yFondo0 : F) - 20) || 250
    const bx0 = xi0 + 12.7, bx1 = xi1 - 12.7, bz0 = zSep + e + 10, bz1 = Math.max(bz0 + 60, zInt1 - 20)
    t.push({ nombre: "Cajón: lado izquierdo", plano: "lateral", rol: "cajon", x0: bx0, x1: bx0 + gC, y0: 0, y1: largo, z0: bz0, z1: bz1 })
    t.push({ nombre: "Cajón: lado derecho", plano: "lateral", rol: "cajon", x0: bx1 - gC, x1: bx1, y0: 0, y1: largo, z0: bz0, z1: bz1 })
    t.push({ nombre: "Cajón: frente interior", plano: "frontal", rol: "cajon", x0: bx0 + gC, x1: bx1 - gC, y0: 0, y1: gC, z0: bz0, z1: bz1 })
    t.push({ nombre: "Cajón: trasera", plano: "frontal", rol: "cajon", x0: bx0 + gC, x1: bx1 - gC, y0: largo - gC, y1: largo, z0: bz0, z1: bz1 })
    t.push({ nombre: "Cajón: fondo", plano: "horizontal", rol: "cajon", material: "hdf", x0: bx0, x1: bx1, y0: 0, y1: largo, z0: bz0 - 3, z1: bz0 })
  } else if (o.frente === "cajones") {
    // cajones iguales en el hueco; cada uno con su frente y su caja sobre correderas
    const n = o.cajones
    const altoF = (fz1 - fz0 - 3 * (n - 1)) / n
    const gC = 15
    const largo = [550, 500, 450, 400, 350, 300, 250].find((l) => l <= (o.fondoTipo === "ranura" ? yFondo0 : F) - 20) || 250
    const bx0 = xi0 + 12.7, bx1 = xi1 - 12.7
    // separadores entre cajones: no hay; las cajas van en el hueco completo, una sobre otra
    const huecoZ0 = zInt0, huecoZ1 = zInt1
    const altoCaja = (huecoZ1 - huecoZ0) / n
    for (let i = 0; i < n; i++) {
      const nom = n > 1 ? `Cajón ${i + 1}` : "Cajón"
      const fz = fz0 + i * (altoF + 3)
      t.push({ nombre: `${nom}: frente`, plano: "frontal", rol: "frente", jaladera: 128, x0: fx0, x1: fx1, y0: yF0, y1: yF1, z0: fz, z1: fz + altoF })
      const bz0 = huecoZ0 + i * altoCaja + 12, bz1 = huecoZ0 + (i + 1) * altoCaja - 25
      if (bz1 - bz0 < 60) {
        avisos.push("Los cajones quedan muy bajos: pon menos cajones o un gabinete más alto.")
        break
      }
      t.push({ nombre: `${nom}: lado izquierdo`, plano: "lateral", rol: "cajon", x0: bx0, x1: bx0 + gC, y0: 0, y1: largo, z0: bz0, z1: bz1 })
      t.push({ nombre: `${nom}: lado derecho`, plano: "lateral", rol: "cajon", x0: bx1 - gC, x1: bx1, y0: 0, y1: largo, z0: bz0, z1: bz1 })
      t.push({ nombre: `${nom}: frente interior`, plano: "frontal", rol: "cajon", x0: bx0 + gC, x1: bx1 - gC, y0: 0, y1: gC, z0: bz0, z1: bz1 })
      t.push({ nombre: `${nom}: trasera`, plano: "frontal", rol: "cajon", x0: bx0 + gC, x1: bx1 - gC, y0: largo - gC, y1: largo, z0: bz0, z1: bz1 })
      t.push({ nombre: `${nom}: fondo`, plano: "horizontal", rol: "cajon", material: "hdf", x0: bx0, x1: bx1, y0: 0, y1: largo, z0: bz0 - 3, z1: bz0 })
    }
  }
  return { tableros: t, avisos }
}
