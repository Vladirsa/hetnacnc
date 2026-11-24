// Malla del mueble de costillas armado, para la vista 3D (Malla3D): cada pieza
// se extruye a su espesor y se coloca en su lugar. Usa el triangulador de
// three, por eso vive aquí y no en el motor 2D.
import { ShapeUtils, Vector2 } from "three"

import type { Pieza3D } from "@/lib/generador/costillas"

type P = [number, number]

const area = (p: P[]) => p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0) / 2

export function trisCostillas(piezas: Pieza3D[], espesor: number): number[] {
  const tris: number[] = []
  const e = espesor / 2
  for (const pz of piezas) {
    // a coordenadas del mundo (mm, Z arriba): costilla en el plano (u, v) en x;
    // travesaño en el plano (x, u) a la altura z
    const mundo = ([a, b]: P, w: number): [number, number, number] => (pz.tipo === "costilla" ? [pz.pos + w, a, b] : [a, b, pz.pos + w])
    const contorno = area(pz.contorno) < 0 ? [...pz.contorno].reverse() : pz.contorno
    const huecos = pz.huecos.map((h) => (area(h) > 0 ? [...h].reverse() : h))
    const caras = ShapeUtils.triangulateShape(
      contorno.map(([x, y]) => new Vector2(x, y)),
      huecos.map((h) => h.map(([x, y]) => new Vector2(x, y))),
    )
    const todos = [...contorno, ...huecos.flat()]
    for (const [i, j, k] of caras) {
      // tapa de un lado (normal hacia -w) y del otro (+w), con el orden invertido
      tris.push(...mundo(todos[i], -e), ...mundo(todos[k], -e), ...mundo(todos[j], -e))
      tris.push(...mundo(todos[i], e), ...mundo(todos[j], e), ...mundo(todos[k], e))
    }
    for (const lazo of [contorno, ...huecos]) {
      for (let i = 0; i < lazo.length; i++) {
        const a = lazo[i]
        const b = lazo[(i + 1) % lazo.length]
        tris.push(...mundo(a, -e), ...mundo(b, -e), ...mundo(b, e))
        tris.push(...mundo(a, -e), ...mundo(b, e), ...mundo(a, e))
      }
    }
  }
  return tris
}
