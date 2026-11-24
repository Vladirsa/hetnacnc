// Tipos mínimos de clipper-lib (unión de contornos en lib/generador/unirContornos.ts)
declare module "clipper-lib" {
  type IntPoint = { X: number; Y: number }
  type Path = IntPoint[]
  const ClipperLib: {
    Clipper: new () => {
      AddPaths(paths: Path[], tipo: number, cerrado: boolean): boolean
      Execute(clip: number, solucion: Path[], relleno1: number, relleno2: number): boolean
    }
    Clipper_CleanPolygons?: (paths: Path[], distancia: number) => Path[]
    PolyType: { ptSubject: number; ptClip: number }
    ClipType: { ctUnion: number; ctIntersection: number; ctDifference: number }
    PolyFillType: { pftNonZero: number; pftEvenOdd: number }
  }
  export default ClipperLib
}
