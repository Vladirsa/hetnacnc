// Pintar por parte las vistas 3D (Estudio3D, Malla3D, el visor de la ficha):
// aparte de multicolor.ts para que el visor no cargue el armado de 3MF y ZIP.

/** Tramo de la malla (triángulos seguidos) y su color #rrggbb, para pintar la vista. */
export type TramoColor = { triangulos: number; hex: string }

/** Color por vértice (RGB lineal, como lo usa three) de una malla no indexada:
 * el vértice i es del triángulo i / 3. null si los tramos no cuadran con la malla. */
export function coloresPorVertice(tramos: TramoColor[] | undefined, nTris: number): Float32Array | null {
  if (!tramos?.length || tramos.reduce((s, t) => s + t.triangulos, 0) !== nTris) return null
  const col = new Float32Array(nTris * 9)
  const lineal = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
  let v = 0
  for (const t of tramos) {
    const h = parseInt(t.hex.slice(1), 16)
    const r = lineal((h >> 16) & 255), g = lineal((h >> 8) & 255), b = lineal(h & 255)
    for (let k = 0; k < t.triangulos * 3; k++, v++) (col[v * 3] = r), (col[v * 3 + 1] = g), (col[v * 3 + 2] = b)
  }
  return col
}
