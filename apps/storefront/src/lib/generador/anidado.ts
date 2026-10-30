// Anidado de piezas: acomoda muchas piezas (DXF o SVG) en hojas de material
// para desperdiciar lo menos posible. Trabaja con el rectángulo que envuelve a
// cada pieza (con giro de 90° opcional) usando el mismo acomodador que el
// despiece de muebles. Todo en el navegador, en milímetros.

import { acomodar, type Pieza as PiezaMueble } from "@/lib/generador/muebles"
import { type Dibujo, type P, type Trazo, medidas } from "@/lib/generador/vectores"

export type PiezaAnidar = {
  id: string
  nombre: string
  dibujo: Dibujo
  cantidad: number
}

export type OpcionesAnidado = {
  hoja: { ancho: number; alto: number }
  separacion: number // entre piezas (kerf + margen)
  margen: number // orilla de la hoja
  girar: boolean // permitir giro de 90°
}

export type Colocacion = { pieza: PiezaAnidar; x: number; y: number; w: number; h: number; girada: boolean; n: number }
export type HojaAnidada = { colocaciones: Colocacion[]; trazos: Trazo[] }
export type ResultadoAnidado = { hojas: HojaAnidada[]; aprovechamiento: number; noCaben: string[]; totalPiezas: number }

function dentro(p: P, poly: P[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Si un archivo trae varias piezas sueltas, las separa: cada contorno cerrado
// que no está dentro de otro es una pieza, con lo que tenga adentro.
export function separarPiezas(d: Dibujo): Dibujo[] {
  const cerrados = d.trazos.filter((t) => t.cerrado && t.pts.length >= 3)
  const abiertos = d.trazos.filter((t) => !t.cerrado)
  const exteriores = cerrados.filter((c) => !cerrados.some((o) => o !== c && dentro(c.pts[0], o.pts)))
  if (exteriores.length <= 1) return [d]
  return exteriores.map((e) => ({
    unidades: d.unidades,
    avisos: [],
    trazos: [e, ...cerrados.filter((c) => c !== e && dentro(c.pts[0], e.pts)), ...abiertos.filter((a) => dentro(a.pts[0], e.pts))],
  }))
}

export function anidar(piezas: PiezaAnidar[], o: OpcionesAnidado): ResultadoAnidado {
  const med = new Map(piezas.map((p) => [p.id, medidas(p.dibujo)]))
  const lista: PiezaMueble[] = piezas
    .filter((p) => p.cantidad > 0)
    .map((p) => {
      const m = med.get(p.id)!
      return { nombre: p.id, cantidad: p.cantidad, largo: m.alto, ancho: m.ancho, espesor: 0, canto: { l: 0, a: 0 } }
    })
  const a = acomodar(lista, o.hoja, { separacion: o.separacion, margen: o.margen, respetarVeta: !o.girar })
  const porId = new Map(piezas.map((p) => [p.id, p]))
  const hojas: HojaAnidada[] = a.hojas.map((cols) => {
    const colocaciones: Colocacion[] = []
    const trazos: Trazo[] = [{ pts: [[0, 0], [o.hoja.ancho, 0], [o.hoja.ancho, o.hoja.alto], [0, o.hoja.alto]], cerrado: true, capa: "HOJA" }]
    for (const c of cols) {
      const pieza = porId.get(c.nombre)!
      const m = med.get(c.nombre)!
      // el acomodador trabaja con Y hacia abajo; el dibujo con Y hacia arriba
      const x = c.x
      const y = o.hoja.alto - c.y - c.h
      colocaciones.push({ pieza, x, y, w: c.w, h: c.h, girada: c.girada, n: c.n })
      for (const t of pieza.dibujo.trazos) {
        const pts: P[] = t.pts.map(([px, py]) => {
          const lx = px - m.x0
          const ly = py - m.y0
          // giro de 90°: (lx, ly) → (ancho_girado - ly, lx)
          return c.girada ? [x + (m.alto - ly), y + lx] : [x + lx, y + ly]
        })
        trazos.push({ pts, cerrado: t.cerrado, capa: "CORTE" })
      }
    }
    return { colocaciones, trazos }
  })
  const noCaben = a.noCaben.map((s) => {
    const id = s.split(" ")[0]
    return s.replace(id, porId.get(id)?.nombre || id)
  })
  return { hojas, aprovechamiento: a.aprovechamiento, noCaben, totalPiezas: lista.reduce((s, p) => s + p.cantidad, 0) }
}

const f = (x: number) => String(Math.round(x * 100) / 100)

// Vista de una hoja: fondo, piezas y número de cada una
export function hojaAnidadaSVG(h: HojaAnidada, hoja: { ancho: number; alto: number }) {
  const Y = (y: number) => hoja.alto - y
  const paths = h.trazos
    .filter((t) => t.capa !== "HOJA")
    .map((t) => `<path d="${t.pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(Y(y))}`).join(" ")}${t.cerrado ? " Z" : ""}" fill="${t.cerrado ? "#FDEEE1" : "none"}" fill-opacity="0.7" stroke="#C2560A" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`)
    .join("")
  const nums = h.colocaciones
    .map((c) => {
      const fs = Math.max(10, Math.min(40, Math.min(c.w, c.h) / 4))
      return `<text x="${f(c.x + c.w / 2)}" y="${f(Y(c.y + c.h / 2))}" font-size="${f(fs)}" text-anchor="middle" dominant-baseline="middle" fill="#142033" font-family="sans-serif" font-weight="bold">${c.n}</text>`
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(hoja.ancho)} ${f(hoja.alto)}"><rect x="0" y="0" width="${f(hoja.ancho)}" height="${f(hoja.alto)}" fill="#F4F1EA" stroke="#9A978C" stroke-width="1" vector-effect="non-scaling-stroke"/>${paths}${nums}</svg>`
}

// Todas las hojas en un solo dibujo (una junto a otra), para DXF o SVG de corte
export function hojasComoDibujo(r: ResultadoAnidado, hoja: { ancho: number; alto: number }, sep = 100): Dibujo {
  const trazos: Trazo[] = []
  r.hojas.forEach((h, k) => {
    const ox = k * (hoja.ancho + sep)
    for (const t of h.trazos) trazos.push({ ...t, pts: t.pts.map(([x, y]) => [x + ox, y] as P) })
  })
  return { trazos, avisos: [], unidades: "mm" }
}
