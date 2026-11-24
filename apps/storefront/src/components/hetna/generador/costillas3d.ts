// Malla del mueble de costillas armado, para la vista 3D (Malla3D): cada pieza
// se extruye a su espesor y se coloca en su lugar. Usa el triangulador de
// three, por eso vive aquí y no en el motor 2D.
import { ShapeUtils, Vector2 } from "three"

import type { Pieza3D } from "@/lib/generador/costillas"
import { type P, area } from "@/lib/generador/geo2d"

/**
 * Quita puntos que casi no cambian la forma (Ramer–Douglas–Peucker, tolerancia
 * en mm): el perfil de una costilla trae un punto cada 3 mm y en la vista
 * basta con mucho menos; las esquinas de las ranuras se quedan.
 */
function simplificar(pts: P[], tol: number): P[] {
  if (pts.length < 8) return pts
  const quedan = new Uint8Array(pts.length)
  const pila: [number, number][] = [[0, pts.length - 1]]
  quedan[0] = quedan[pts.length - 1] = 1
  while (pila.length) {
    const [i, j] = pila.pop()!
    const [ax, ay] = pts[i]
    const [bx, by] = pts[j]
    const largo = Math.hypot(bx - ax, by - ay) || 1
    let peor = -1
    let dist = tol
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / largo
      if (d > dist) { dist = d; peor = k }
    }
    if (peor >= 0) {
      quedan[peor] = 1
      pila.push([i, peor], [peor, j])
    }
  }
  return pts.filter((_, k) => quedan[k])
}

export function trisCostillas(piezas: Pieza3D[], espesor: number, tol = 0.8): number[] {
  const tris: number[] = []
  const e = espesor / 2
  for (const pz of piezas) {
    // a coordenadas del mundo (mm, Z arriba): costilla en el plano (u, v) en x;
    // travesaño en el plano (x, u) a la altura z
    const mundo = ([a, b]: P, w: number): [number, number, number] => (pz.tipo === "costilla" ? [pz.pos + w, a, b] : [a, b, pz.pos + w])
    const simple = simplificar(pz.contorno, tol)
    const contorno = area(simple) < 0 ? [...simple].reverse() : simple
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
