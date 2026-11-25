// Lista de corte, acomodo en hojas y DXF de un plano HETNA (lib/planos/modelos.ts).
import { acomodarEnTablero, type Acomodo } from "@/lib/generador/acomodoHojas"
import { circulo, dibujo, rect } from "@/lib/generador/geo2d"
import { dibujoDXF } from "@/lib/generador/vectores"
import { MATERIALES_PLANO, type MaterialPlano, type PiezaPlano, type Plano } from "./modelos"
import { firmaBarrenos, unionesDe, type Barreno } from "./uniones"
import type { RanuraPieza } from "./modelos"

export const HOJA = { largo: 2440, ancho: 1220 } // triplay estándar
export const SEPARACION = 4 // ancho del disco o de la fresa
export const MARGEN = 10

export type FilaCorte = {
  letra: string
  nombre: string // nombre de la pieza (sin el número si hay varias iguales)
  cantidad: number
  largo: number
  ancho: number
  grosor: number
  material: MaterialPlano
  /** Barrenos guía de tornillo (coordenadas de la pieza: u a lo largo, v a lo ancho) */
  barrenos: Barreno[]
  /** Cajas (ranuras) en la cara de la pieza, si el plano va «con ranuras» */
  ranuras: RanuraPieza[]
}

const r = (n: number) => Math.round(n * 10) / 10
// medidas de corte: el grosor es la medida menor; largo ≥ ancho
export function medidas(pz: PiezaPlano) {
  const d = [pz.x1 - pz.x0, pz.y1 - pz.y0, pz.z1 - pz.z0].map(r).sort((a, b) => a - b)
  return { grosor: d[0], ancho: d[1], largo: d[2] }
}

// "División 1", "División 2" → "División"; "Cajón 3 · frente" → "Cajón · frente"
const nombreBase = (n: string) => n.replace(/\s\d+(?=\s·|$)/, "").trim()

const letra = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)))

/** Piezas iguales (medidas y material) juntas, de la más grande a la más chica. */
export function listaCorte(plano: Plano): { filas: FilaCorte[]; letraDe: Map<PiezaPlano, string> } {
  const k = plano.juego?.cantidad ?? 1
  const { barrenos } = unionesDe(plano)
  const grupos = new Map<string, { fila: Omit<FilaCorte, "letra">; piezas: PiezaPlano[] }>()
  for (const [i, pz] of plano.piezas.entries()) {
    const m = medidas(pz)
    // piezas iguales = mismas medidas, material y barrenos (aunque estén volteadas)
    const fb = firmaBarrenos(pz, barrenos[i], plano.ranuras?.[i] || [])
    const clave = [pz.material, m.largo, m.ancho, m.grosor, fb.firma].join("|")
    const g = grupos.get(clave)
    if (g) {
      g.fila.cantidad += k
      g.piezas.push(pz)
      const b = nombreBase(pz.nombre)
      if (!g.fila.nombre.split(" / ").includes(b) && g.fila.nombre.length < 60) g.fila.nombre += ` / ${b}`
    } else grupos.set(clave, { fila: { nombre: nombreBase(pz.nombre), cantidad: k, ...m, material: pz.material, barrenos: fb.barrenos, ranuras: fb.ranuras }, piezas: [pz] })
  }
  const orden = [...grupos.values()].sort((a, b) => b.fila.grosor - a.fila.grosor || b.fila.largo * b.fila.ancho - a.fila.largo * a.fila.ancho)
  const letraDe = new Map<PiezaPlano, string>()
  const filas = orden.map((g, i) => {
    const l = letra(i)
    g.piezas.forEach((pz) => letraDe.set(pz, l))
    return { letra: l, ...g.fila }
  })
  return { filas, letraDe }
}

export type AcomodoMaterial = { material: MaterialPlano; nombre: string; acomodo: Acomodo }

/** Acomodo de las piezas en hojas de 2440 × 1220, una tanda por material. */
export function acomodoPorMaterial(filas: FilaCorte[]): AcomodoMaterial[] {
  const mats = [...new Set(filas.map((f) => f.material))]
  return mats.map((material) => {
    const piezas = filas.filter((f) => f.material === material).map((f) => ({
      id: f.letra,
      nombre: f.letra,
      trazos: [rect(0, 0, f.largo, f.ancho)],
      veta: "libre" as const,
      cantidad: f.cantidad,
    }))
    const acomodo = acomodarEnTablero(piezas, { largo: HOJA.largo, ancho: HOJA.ancho, separacion: SEPARACION, margen: MARGEN, conVeta: false, etiquetas: false })
    return { material, nombre: MATERIALES_PLANO[material].nombre, acomodo }
  })
}

/** Cuántas hojas de cada material hay que comprar. */
export const hojasNecesarias = (acs: AcomodoMaterial[]) => acs.map((a) => ({ nombre: a.nombre, hojas: a.acomodo.hojas.length }))

/** DXF para router CNC: cada hoja acomodada, una al lado de otra, con su contorno en capa "hoja". */
/** Rectángulos de las ranuras de una pieza ya colocada en la hoja: [x0, y0, x1, y1, prof]. */
export function rectsRanuras(c: { x: number; y: number; girada: boolean }, fila?: { ranuras?: RanuraPieza[]; ancho: number }): [number, number, number, number, number][] {
  if (!fila?.ranuras?.length) return []
  return fila.ranuras.map((r) =>
    c.girada ? [c.x + (fila.ancho - r.v1), c.y + r.u0, c.x + (fila.ancho - r.v0), c.y + r.u1, r.prof] : [c.x + r.u0, c.y + r.v0, c.x + r.u1, c.y + r.v1, r.prof]
  )
}

/** Dónde caen los barrenos de una pieza ya colocada en la hoja (respeta si va girada). */
export function puntosBarrenos(c: { x: number; y: number; w: number; h: number; girada: boolean }, fila?: { barrenos: { u: number; v: number }[]; ancho: number }): [number, number][] {
  if (!fila?.barrenos?.length) return []
  return fila.barrenos.map((b) => (c.girada ? [c.x + (fila.ancho - b.v), c.y + b.u] : [c.x + b.u, c.y + b.v]))
}

export function dxfPlano(acs: AcomodoMaterial[], filas: FilaCorte[] = []): { nombre: string; dxf: string }[] {
  const barrenosDe = new Map(filas.map((f) => [f.letra, f]))
  return acs.map((a) => {
    const trazos = a.acomodo.hojas.flatMap((h, i) => {
      const dx = i * (HOJA.largo + 200)
      return [
        rect(dx, 0, dx + HOJA.largo, HOJA.ancho, 0, "hoja"),
        ...h.colocadas.map((c) => rect(dx + c.x, c.y, dx + c.x + c.w, c.y + c.h, 0, `corte_${c.nombre}`)),
        // barrenos guía de 3 mm (capa aparte: se taladran antes de cortar el contorno)
        ...h.colocadas.flatMap((c) => puntosBarrenos(c, barrenosDe.get(c.nombre)).map(([x, y]) => circulo(dx + x, y, 1.5, "barrenos"))),
        // ranuras: caja de 4 o 6 mm de profundidad, capa con la profundidad en el nombre
        ...h.colocadas.flatMap((c) => rectsRanuras(c, barrenosDe.get(c.nombre)).map(([x0, y0, x1, y1, prof]) => rect(dx + x0, y0, dx + x1, y1, 0, `ranura_${prof}mm`))),
      ]
    })
    return { nombre: a.nombre, dxf: dibujoDXF(dibujo(trazos)) }
  })
}

/** Medidas generales del mueble armado. */
export function medidasGenerales(plano: Plano) {
  const xs = plano.piezas.flatMap((q) => [q.x0, q.x1]), ys = plano.piezas.flatMap((q) => [q.y0, q.y1]), zs = plano.piezas.flatMap((q) => [q.z0, q.z1])
  // con ruedas, el alto se mide desde el piso
  const z0 = Math.min(...zs) - (plano.ruedas ?? 0)
  return { ancho: r(Math.max(...xs) - Math.min(...xs)), fondo: r(Math.max(...ys) - Math.min(...ys)), alto: r(Math.max(...zs) - z0) }
}
