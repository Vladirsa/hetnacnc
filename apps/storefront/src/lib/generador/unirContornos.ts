// Une contornos que se enciman (regla "non-zero"): con letra cursiva las letras
// se traslapan (la "o" de Sofía toca la "S" y la "f") y, si se extruyen o se
// cortan tal cual, la parte encimada queda como hueco (regla par-impar) y se
// "borran" pedazos de letras; en el DXF quedan líneas cruzadas dentro de las
// letras que el láser cortaría. Unidos, cada grupo de letras es una sola figura
// y los huecos de verdad (los de la o, a, e) se conservan.
import ClipperLib from "clipper-lib"

type P = [number, number]
const ESCALA = 1000 // clipper trabaja con enteros: 0.001 mm

export function unirContornos(contornos: P[][]): P[][] {
  const caminos = contornos
    .filter((p) => p.length >= 3)
    .map((p) => p.map(([x, y]) => ({ X: Math.round(x * ESCALA), Y: Math.round(y * ESCALA) })))
  if (!caminos.length) return []
  const c = new ClipperLib.Clipper()
  c.AddPaths(caminos, ClipperLib.PolyType.ptSubject, true)
  const sol: { X: number; Y: number }[][] = []
  if (!c.Execute(ClipperLib.ClipType.ctUnion, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)) return contornos
  return sol.filter((p) => p.length >= 3).map((p) => p.map((q) => [q.X / ESCALA, q.Y / ESCALA] as P))
}
