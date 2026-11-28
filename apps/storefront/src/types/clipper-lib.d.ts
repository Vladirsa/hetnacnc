// Tipos mínimos de clipper-lib (unión de contornos en lib/generador/unirContornos.ts
// y soldar, restar y offset del diseñador de vectores: lib/disenador/geometria.ts)
declare module "clipper-lib" {
  type IntPoint = { X: number; Y: number }
  type Path = IntPoint[]
  const ClipperLib: {
    Clipper: (new () => {
      AddPaths(paths: Path[], tipo: number, cerrado: boolean): boolean
      Execute(clip: number, solucion: Path[], relleno1: number, relleno2: number): boolean
      StrictlySimple: boolean
    }) & {
      CleanPolygons(paths: Path[], distancia?: number): Path[]
      Area(path: Path): number
    }
    Clipper_CleanPolygons?: (paths: Path[], distancia: number) => Path[]
    ClipperOffset: new (miterLimit?: number, arcTolerance?: number) => {
      AddPaths(paths: Path[], union: number, fin: number): void
      Execute(solucion: Path[], delta: number): void
      ArcTolerance: number
    }
    JoinType: { jtSquare: number; jtRound: number; jtMiter: number }
    EndType: { etClosedPolygon: number; etClosedLine: number; etOpenButt: number; etOpenSquare: number; etOpenRound: number }
    PolyType: { ptSubject: number; ptClip: number }
    ClipType: { ctUnion: number; ctIntersection: number; ctDifference: number }
    PolyFillType: { pftNonZero: number; pftEvenOdd: number }
  }
  export default ClipperLib
}
