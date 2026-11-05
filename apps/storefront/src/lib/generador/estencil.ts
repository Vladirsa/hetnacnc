// Esténcil de letras (2D Studio): plantillas para pintar con aerosol. Las
// letras se calan en la hoja y a cada "isla" (el centro de la O, la A, la B…)
// se le deja un puente para que no se caiga. Se trabaja en una rejilla fina:
// se rellena el texto, se cortan los puentes y se vuelve a contorno.
import { type P, type Trazo, curvasATrazos, dibujo, rect } from "@/lib/generador/geo2d"
import { type Fuente, type Rejilla, rellenar, textoACurvas } from "@/lib/generador/letreros"
import { contornos, curvasDeMascara, type Curva } from "@/lib/generador/trazado"

export type OpcionesEstencil = {
  texto: string
  alto: number // mm de la mayúscula
  espaciado: number
  puentes: boolean
  anchoPuente: number // mm
  margen: number // mm de hoja alrededor del texto
  radio: number
}

function limites(curvas: Curva[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const ver = (p: [number, number]) => {
    if (p[0] < x0) x0 = p[0]
    if (p[0] > x1) x1 = p[0]
    if (p[1] < y0) y0 = p[1]
    if (p[1] > y1) y1 = p[1]
  }
  for (const c of curvas) {
    ver(c.inicio)
    for (const t of c.tramos) {
      ver(t.p)
      if ("c1" in t) {
        ver(t.c1)
        ver(t.c2)
      }
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
}

export function hacerEstencil(fuente: Fuente | null, o: OpcionesEstencil) {
  const avisos: string[] = []
  if (!fuente) return { dibujo: null, avisos: ["Cargando la letra…"], puentes: 0, ancho: 0, alto: 0 }
  if (!o.texto.trim()) return { dibujo: null, avisos: ["Escribe el texto."], puentes: 0, ancho: 0, alto: 0 }
  const { curvas } = textoACurvas(fuente, { texto: o.texto.trim(), alto: o.alto, espaciado: o.espaciado, interlineado: 1.3, alineacion: "centro" })
  const b = limites(curvas)
  if (!b) return { dibujo: null, avisos: ["La letra no tiene esos caracteres."], puentes: 0, ancho: 0, alto: 0 }
  const orilla = 2
  const anchoMM = b.x1 - b.x0 + 2 * orilla
  const altoMM = b.y1 - b.y0 + 2 * orilla
  const pxmm = Math.max(2, Math.min(16, Math.sqrt(5e6 / (anchoMM * altoMM))))
  const g: Rejilla = { w: Math.ceil(anchoMM * pxmm), h: Math.ceil(altoMM * pxmm), x0: b.x0 - orilla, y0: b.y0 - orilla, pxmm, m: new Uint8Array(0) }
  g.m = new Uint8Array(g.w * g.h)
  rellenar(curvas, g)

  // Puentes: una franja vertical por cada isla, a lo alto de su letra
  let puentes = 0
  if (o.puentes) {
    const lazos = contornos(g.m, g.w, g.h)
    const cajaDe = (pts: [number, number][]) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const [x, y] of pts) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
      return { x0, y0, x1, y1 }
    }
    const fuera = lazos.filter((l) => l.area > 0).map((l) => ({ ...cajaDe(l.pts), area: l.area }))
    const huecos = lazos.filter((l) => l.area < 0 && Math.abs(l.area) > 4)
    const medio = Math.max(1, Math.round((o.anchoPuente * pxmm) / 2))
    for (const h of huecos) {
      const c = cajaDe(h.pts)
      const letra = fuera
        .filter((f) => f.x0 <= c.x0 && f.x1 >= c.x1 && f.y0 <= c.y0 && f.y1 >= c.y1)
        .sort((a, b2) => a.area - b2.area)[0]
      if (!letra) continue
      const cx = Math.round((c.x0 + c.x1) / 2)
      for (let y = Math.max(0, Math.floor(letra.y0)); y < Math.min(g.h, Math.ceil(letra.y1)); y++)
        for (let x = Math.max(0, cx - medio); x < Math.min(g.w, cx + medio); x++) g.m[y * g.w + x] = 0
      puentes++
    }
  }

  // De vuelta a contornos, en mm con Y hacia arriba
  const curvasFinales = curvasDeMascara(g.m, g.w, g.h, { tolerancia: 0.6, manchas: Math.max(4, pxmm * pxmm * 0.5), suave: true })
  const letras: Trazo[] = curvasATrazos(curvasFinales, "corte").map((t) => ({
    ...t,
    pts: t.pts.map(([x, y]) => [x / pxmm + g.x0, -(y / pxmm + g.y0)] as P),
  }))
  const W = b.x1 - b.x0
  const Hh = b.y1 - b.y0
  const m = Math.max(5, o.margen)
  const hoja = rect(b.x0 - m, -b.y1 - m, b.x1 + m, -b.y0 + m, o.radio)
  if (o.puentes && o.anchoPuente < 2) avisos.push("Puentes de menos de 2 mm se rompen fácil al pintar.")
  if (!o.puentes) avisos.push("Sin puentes, los centros de letras como O, A, B, D, P y R se caen. Úsalo sólo con letra esténcil.")
  avisos.push("Corta en material delgado (acrílico de 1 a 3 mm, MDF de 3 mm o lámina) y pinta con capas ligeras.")
  return { dibujo: dibujo([hoja, ...letras], avisos), avisos, puentes, ancho: W + 2 * m, alto: Hh + 2 * m }
}
