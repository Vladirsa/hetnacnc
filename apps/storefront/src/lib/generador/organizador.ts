// Organizadores de cajón (2D Studio): separadores que se encastran a media
// madera (como las rejillas de los huevos). Las tiras a lo ancho llevan las
// ranuras arriba y las de fondo abajo; con "paredes" también salen las cuatro
// orillas, que en las esquinas se unen a media madera (la ranura queda en la
// punta de cada pared y las dos mitades se completan).
//
//   vista desde arriba          tira a lo ancho (ranuras arriba)
//   ┌──┬──┬─────┐              ┌─┐  ┌─┐  ┌──────┐
//   │  │  │     │              │ └──┘ └──┘      │
//   ├──┼──┼─────┤              └────────────────┘
import { type Trazo, acomodarEnHojas, arco, dibujo, trazo, type P } from "@/lib/generador/geo2d"

export type OpcionesOrganizador = {
  ancho: number // medida interior del cajón (X)
  fondo: number // medida interior del cajón (Y)
  alto: number // alto de los separadores
  espesor: number
  holgura: number // mm extra en cada ranura
  columnas: number[] // proporciones a lo ancho, p. ej. [1, 1, 2]
  filas: number[] // proporciones a lo fondo
  paredes: boolean
  dedos: boolean // muesca redonda arriba de cada compartimento
  hoja: { ancho: number; alto: number }
}

/** Posiciones (centro de cada separador) repartiendo el largo según las proporciones. */
function posiciones(largo: number, proporciones: number[], t: number, paredes: boolean) {
  const suma = proporciones.reduce((a, b) => a + b, 0) || 1
  // con paredes, las orillas van al centro de su espesor dentro del cajón
  const inicio = paredes ? t / 2 : 0
  const fin = paredes ? largo - t / 2 : largo
  const util = fin - inicio
  const pos: number[] = [inicio]
  let acum = 0
  for (const p of proporciones) {
    acum += p
    pos.push(inicio + (util * acum) / suma)
  }
  return paredes ? pos : pos.slice(1, -1)
}

/** Una tira con ranuras (arriba o abajo) y muescas para los dedos. */
function tira(largo: number, alto: number, ranuras: number[], ancho: number, arriba: boolean, muescas: number[], radioMuesca: number): Trazo {
  const prof = alto / 2
  const pts: P[] = []
  // Se recorre en sentido antihorario: abajo de izquierda a derecha, luego arriba de derecha a izquierda
  const borde = (y: number, haciaDerecha: boolean, conRanuras: boolean, conMuescas: boolean) => {
    type Evento = { x: number; tipo: "r" | "m" }
    const ev: Evento[] = []
    if (conRanuras) for (const x of ranuras) ev.push({ x, tipo: "r" })
    if (conMuescas) for (const x of muescas) ev.push({ x, tipo: "m" })
    ev.sort((a, b) => (haciaDerecha ? a.x - b.x : b.x - a.x))
    const adentro = y === 0 ? prof : alto - prof // y del fondo de la ranura
    for (const e of ev) {
      const s = haciaDerecha ? 1 : -1
      if (e.tipo === "r") {
        const lim = (v: number) => Math.max(0, Math.min(largo, v))
        const a = lim(e.x - (s * ancho) / 2)
        const b = lim(e.x + (s * ancho) / 2)
        pts.push([a, y], [a, adentro], [b, adentro], [b, y])
      } else {
        // semicírculo hacia abajo (sólo en el borde de arriba, de derecha a izquierda)
        for (const p of arco(e.x, y, radioMuesca, 0, -Math.PI)) pts.push(p)
      }
    }
  }
  pts.push([0, 0])
  borde(0, true, !arriba, false)
  pts.push([largo, 0], [largo, alto])
  borde(alto, false, arriba, true)
  pts.push([0, alto])
  return trazo(limpiar(pts))
}

/** Quita puntos repetidos y los que quedan en línea recta con sus vecinos. */
function limpiar(pts: P[]): P[] {
  let out = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6)
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const n = out.length
    out = out.filter((p, i) => {
      const a = out[(i - 1 + n) % n]
      const b = out[(i + 1) % n]
      const cruz = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])
      return Math.abs(cruz) > 1e-6
    })
  }
  return out
}

export function hacerOrganizador(o: OpcionesOrganizador) {
  const avisos: string[] = []
  const t = Math.max(1, o.espesor)
  const ranura = t + Math.max(0, o.holgura)
  const cols = o.columnas.filter((x) => x > 0).slice(0, 20)
  const fils = o.filas.filter((x) => x > 0).slice(0, 20)
  if (!cols.length || !fils.length) return { dibujo: null, avisos: ["Pon al menos una columna y una fila."], piezas: 0, hojas: 0, celdas: [] as string[] }
  const xs = posiciones(o.ancho, cols, t, o.paredes) // separadores a lo fondo (en X)
  const ys = posiciones(o.fondo, fils, t, o.paredes) // separadores a lo ancho (en Y)
  if (!xs.length && !ys.length) return { dibujo: null, avisos: ["Con una sola columna y una fila no hay separadores: activa las paredes o agrega divisiones."], piezas: 0, hojas: 0, celdas: [] as string[] }
  const radio = Math.min(o.alto * 0.35, 14)
  // Muescas al centro de cada compartimento (no en las paredes de afuera)
  const centros = (pos: number[], largo: number) => {
    const bordes = o.paredes ? pos : [0, ...pos, largo]
    const c: number[] = []
    for (let i = 0; i < bordes.length - 1; i++) {
      const a = bordes[i] + t / 2
      const b = bordes[i + 1] - t / 2
      if (b - a > radio * 2 + 6) c.push((a + b) / 2)
    }
    return c
  }
  const grupos: Trazo[][] = []
  // Tiras a lo ancho (largo = ancho del cajón): ranuras arriba donde cruzan las de fondo
  ys.forEach((y, i) => {
    const pared = o.paredes && (i === 0 || i === ys.length - 1)
    grupos.push([tira(o.ancho, o.alto, xs, ranura, true, o.dedos && !pared ? centros(xs, o.ancho) : [], radio)])
  })
  // Tiras a lo fondo: ranuras abajo
  xs.forEach((x, i) => {
    const pared = o.paredes && (i === 0 || i === xs.length - 1)
    grupos.push([tira(o.fondo, o.alto, ys, ranura, false, o.dedos && !pared ? centros(ys, o.fondo) : [], radio)])
  })
  // Medidas de cada compartimento (por dentro)
  const bx = o.paredes ? xs : [0 - t / 2, ...xs, o.ancho + t / 2]
  const by = o.paredes ? ys : [0 - t / 2, ...ys, o.fondo + t / 2]
  const anchos = bx.slice(1).map((x, i) => x - bx[i] - t)
  const fondos = by.slice(1).map((y, i) => y - by[i] - t)
  const celdas = [`${anchos.map((a) => Math.round(a)).join(" · ")} mm a lo ancho`, `${fondos.map((a) => Math.round(a)).join(" · ")} mm a lo fondo`]
  if (Math.min(...anchos, ...fondos) < 15) avisos.push("Hay compartimentos de menos de 15 mm: revisa las proporciones.")
  const r = acomodarEnHojas(grupos, o.hoja, 6)
  if (r.noCaben) avisos.push(`${r.noCaben} tiras no caben en la hoja: usa una hoja más grande.`)
  if (o.paredes) avisos.push("Las medidas son las de adentro del cajón; si entra muy justo, quita 1 mm al ancho y al fondo.")
  avisos.push(`Ranuras de ${ranura.toFixed(1)} mm: si el material sale más grueso, sube la holgura. Corta primero una tira de prueba.`)
  return { dibujo: dibujo(r.trazos, avisos), avisos, piezas: grupos.length, hojas: r.hojas, celdas }
}

