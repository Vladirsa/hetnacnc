// Archivos para impresoras de varios colores (AMS, MMU, cambio de filamento).
// Cada herramienta arma su pieza en partes con nombre (lib/generador/vectores:
// conPartes); aquí se le pone un color a cada parte y se sacan:
//  · un 3MF con un objeto por parte, juntos en un ensamble (el slicer lo abre
//    como una sola pieza con varias partes y a cada una se le asigna un
//    filamento). Los colores van como sugerencia: no todos los slicers los leen.
//  · un ZIP con un STL por color, que abre en cualquier slicer: se cargan
//    todos juntos y se les dice que son una sola pieza.
import { strToU8, zipSync } from "fflate"

import { type Malla, mallaSTL, separarPartes } from "@/lib/generador/vectores"

/** Colores de filamento comunes (PLA) para elegir rápido. */
export const PALETA: { id: string; nombre: string; hex: string }[] = [
  { id: "negro", nombre: "Negro", hex: "#1d1d1f" },
  { id: "blanco", nombre: "Blanco", hex: "#f4f4f2" },
  { id: "gris", nombre: "Gris", hex: "#8a8f98" },
  { id: "rojo", nombre: "Rojo", hex: "#d42a2a" },
  { id: "naranja", nombre: "Naranja", hex: "#ff6a1a" },
  { id: "amarillo", nombre: "Amarillo", hex: "#f5c400" },
  { id: "verde", nombre: "Verde", hex: "#1f9d4c" },
  { id: "azul", nombre: "Azul", hex: "#1f5fd1" },
  { id: "morado", nombre: "Morado", hex: "#7a3fc4" },
  { id: "rosa", nombre: "Rosa", hex: "#f27fb2" },
  { id: "cafe", nombre: "Café", hex: "#7a4b2a" },
  { id: "dorado", nombre: "Dorado", hex: "#c9a23a" },
]

export const colorPorId = (id: string) => PALETA.find((c) => c.id === id) || PALETA[0]

/** Colores de arranque para n partes: la base oscura y lo que resalta en otro color. */
export function coloresIniciales(n: number): string[] {
  const orden = ["negro", "blanco", "naranja", "azul", "rojo", "verde", "amarillo", "morado"]
  return Array.from({ length: n }, (_, i) => orden[i % orden.length])
}

export type ParteColor = { nombre: string; tris: number[]; color: string }

/** Las partes de la malla con su color (id de PALETA), en orden. */
export function partesConColor(m: Malla, colores: string[], nombre = "Pieza"): ParteColor[] {
  return separarPartes(m, nombre).map((p, i) => ({ ...p, color: colores[i] || coloresIniciales(i + 1)[i] }))
}

/** Malla indexada: un vértice por posición (redondeada a 0.0001 mm). */
export function indexar(t: number[]): { pos: number[]; ind: Uint32Array } {
  const idx = new Map<string, number>(), pos: number[] = [], ind = new Uint32Array(t.length / 3)
  for (let i = 0; i < t.length; i += 3) {
    const k = `${t[i].toFixed(4)},${t[i + 1].toFixed(4)},${t[i + 2].toFixed(4)}`
    let j = idx.get(k)
    if (j === undefined) idx.set(k, (j = pos.length / 3)), pos.push(t[i], t[i + 1], t[i + 2])
    ind[i / 3] = j
  }
  return { pos, ind }
}

/** Separa una malla en sus cuerpos sueltos (triángulos unidos por vértices compartidos). */
export function separarPiezas(t: number[]): number[][] {
  const n = t.length / 9
  const { ind } = indexar(t)
  const padre = Array.from({ length: n }, (_, i) => i)
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])))
  const primero = new Map<number, number>()
  for (let i = 0; i < n; i++)
    for (let v = 0; v < 3; v++) {
      const j = primero.get(ind[i * 3 + v])
      if (j === undefined) primero.set(ind[i * 3 + v], i)
      else padre[raiz(i)] = raiz(j)
    }
  const grupos = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = raiz(i)
    let g = grupos.get(r)
    if (!g) grupos.set(r, (g = []))
    for (let k = 0; k < 9; k++) g.push(t[i * 9 + k])
  }
  return [...grupos.values()]
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const num = (n: number) => String(Math.round(n * 10000) / 10000)

/** 3MF (especificación base) con un objeto por parte dentro de un ensamble. */
export function archivo3MF(partes: ParteColor[], titulo = "HETNA"): Uint8Array {
  const vivas = partes.filter((p) => p.tris.length >= 9)
  const usados = [...new Set(vivas.map((p) => p.color))]
  const materiales = usados.map((id) => `<base name="${xml(colorPorId(id).nombre)}" displaycolor="${colorPorId(id).hex.toUpperCase()}FF"/>`).join("")
  const objetos = vivas
    .map((p, i) => {
      const { pos, ind } = indexar(p.tris)
      const v: string[] = []
      for (let k = 0; k < pos.length; k += 3) v.push(`<vertex x="${num(pos[k])}" y="${num(pos[k + 1])}" z="${num(pos[k + 2])}"/>`)
      const t: string[] = []
      for (let k = 0; k < ind.length; k += 3) t.push(`<triangle v1="${ind[k]}" v2="${ind[k + 1]}" v3="${ind[k + 2]}"/>`)
      return `<object id="${i + 2}" type="model" name="${xml(p.nombre)}" pid="1" pindex="${usados.indexOf(p.color)}"><mesh><vertices>${v.join("")}</vertices><triangles>${t.join("")}</triangles></mesh></object>`
    })
    .join("\n")
  const ensamble = vivas.length + 2
  const componentes = vivas.map((_, i) => `<component objectid="${i + 2}"/>`).join("")
  const modelo = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-MX" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xml(titulo)}</metadata>
<metadata name="Application">HETNA</metadata>
<resources>
<basematerials id="1">${materiales}</basematerials>
${objetos}
<object id="${ensamble}" type="model" name="${xml(titulo)}"><components>${componentes}</components></object>
</resources>
<build><item objectid="${ensamble}"/></build>
</model>`
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
    ),
    "3D/3dmodel.model": strToU8(modelo),
  })
}

/** ZIP con un STL por color (las partes del mismo color van juntas) y un LEEME. */
export function zipPorColor(partes: ParteColor[], base: string): Uint8Array {
  // (concat y no push(...): una malla grande pasa del límite de argumentos)
  const porColor = new Map<string, number[]>()
  for (const p of partes) if (p.tris.length >= 9) porColor.set(p.color, (porColor.get(p.color) || []).concat(p.tris))
  const archivos: Record<string, Uint8Array> = {}
  const lista: string[] = []
  let i = 1
  for (const [color, tris] of porColor) {
    const nombre = `${base}-${i++}-${color}.stl`
    archivos[nombre] = new Uint8Array(mallaSTL({ tris, avisos: [] }))
    const de = partes.filter((p) => p.color === color && p.tris.length >= 9).map((p) => p.nombre)
    lista.push(`${nombre}: ${colorPorId(color).nombre} (${de.join(", ")})`)
  }
  archivos["LEEME.txt"] = strToU8(
    [
      "Pieza de varios colores de HETNA",
      "",
      ...lista,
      "",
      "Cómo imprimirla:",
      "1. Abre todos los STL a la vez en tu slicer (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura).",
      "2. Cuando pregunte, dile que son una sola pieza con varias partes; ya vienen en su lugar, no las muevas.",
      "3. A cada parte asígnale el filamento de su color.",
      "",
      "Si tu impresora es de un solo color, imprime la pieza normal y cambia el filamento a mano en la altura donde empieza el otro color.",
    ].join("\r\n")
  )
  return zipSync(archivos)
}
