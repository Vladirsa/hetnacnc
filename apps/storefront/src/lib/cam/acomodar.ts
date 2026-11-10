// Acomoda varias copias de una pieza en la hoja, en filas y columnas, para
// cortarlas en un solo programa. Prueba la pieza derecha y girada 90° y se
// queda con la orientación en la que caben más.
//
// Es un acomodo en cuadrícula por la caja que envuelve a la pieza: no encaja
// piezas irregulares unas dentro de otras.
import type { Dibujo, P } from "@/lib/generador/vectores"

export type Hoja = { copias: number; ancho: number; largo: number; separacion: number }
export type Acomodo = {
  dibujo: Dibujo
  /** Cuántas copias quedaron (puede ser menos de las pedidas si no caben) */
  puestas: number
  /** Cuántas caben en la hoja con esta orientación */
  caben: number
  girada: boolean
  /** Lo que ocupan las copias puestas (mm) */
  ocupa: [number, number]
  aviso: string | null
}

export function acomodarCopias(d: Dibujo, h: Hoja): Acomodo {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of d.trazos)
    for (const [x, y] of t.pts) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  const w = x1 - x0, al = y1 - y0
  const pedidas = Math.max(1, Math.min(500, Math.round(h.copias) || 1))
  const sep = Math.max(0, h.separacion || 0)
  if (pedidas === 1 || !(w > 0) || !(al > 0)) return { dibujo: d, puestas: 1, caben: 1, girada: false, ocupa: [Math.max(0, w), Math.max(0, al)], aviso: null }

  const cuantas = (pw: number, ph: number) => {
    const cols = Math.floor((h.ancho + sep) / (pw + sep)), filas = Math.floor((h.largo + sep) / (ph + sep))
    return { cols: Math.max(0, cols), filas: Math.max(0, filas), total: Math.max(0, cols) * Math.max(0, filas) }
  }
  const derecha = cuantas(w, al), girada = cuantas(al, w)
  const usarGirada = girada.total > derecha.total
  const op = usarGirada ? girada : derecha
  const pw = usarGirada ? al : w, ph = usarGirada ? w : al
  if (op.total === 0) {
    return { dibujo: d, puestas: 1, caben: 0, girada: false, ocupa: [w, al], aviso: `La pieza (${w.toFixed(0)} × ${al.toFixed(0)} mm) no cabe en una hoja de ${h.ancho} × ${h.largo} mm.` }
  }
  const puestas = Math.min(pedidas, op.total)
  // la pieza llevada al origen, derecha o girada 90°
  const base = (p: P): P => (usarGirada ? [y1 - p[1], p[0] - x0] : [p[0] - x0, p[1] - y0])
  const trazos: Dibujo["trazos"] = []
  for (let k = 0; k < puestas; k++) {
    const dx = (k % op.cols) * (pw + sep), dy = Math.floor(k / op.cols) * (ph + sep)
    for (const t of d.trazos) trazos.push({ ...t, pts: t.pts.map((p) => { const q = base(p); return [q[0] + dx, q[1] + dy] as P }) })
  }
  const cols = Math.min(puestas, op.cols), filas = Math.ceil(puestas / op.cols)
  return {
    dibujo: { ...d, trazos },
    puestas,
    caben: op.total,
    girada: usarGirada,
    ocupa: [cols * pw + (cols - 1) * sep, filas * ph + (filas - 1) * sep],
    aviso: puestas < pedidas ? `En la hoja caben ${op.total} copias; se acomodaron ${puestas} de las ${pedidas} que pediste. Las demás van en otra hoja.` : null,
  }
}
