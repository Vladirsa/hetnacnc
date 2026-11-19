// Texto a trazos en mm (Y hacia arriba), centrado en (0,0): lo usan los
// generadores del 2D Studio que llevan números o nombres (relojes, marcos).
import { type P, type Trazo, cajaDibujo, curvasATrazos, mover } from "@/lib/generador/geo2d"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { unirContornos } from "@/lib/generador/unirContornos"

export function textoATrazos(fuente: Fuente, texto: string, alto: number, capa = "grabado", espaciado = 0): Trazo[] {
  if (!texto.trim() || !(alto > 0)) return []
  const { curvas } = textoACurvas(fuente, { texto: texto.trim(), alto, espaciado, interlineado: 1.25, alineacion: "centro" })
  // unidas: en letra cursiva las letras se enciman y, sin unir, se "borran" pedazos
  const unidos = unirContornos(curvasATrazos(curvas, capa).map((tr) => tr.pts.map(([x, y]) => [x, -y] as P)))
  const t: Trazo[] = unidos.map((pts) => ({ pts, cerrado: true, capa }))
  if (!t.length) return []
  const b = cajaDibujo(t)
  return t.map((tr) => ({ ...tr, pts: mover(tr.pts, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2) }))
}
