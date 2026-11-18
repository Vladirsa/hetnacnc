// Construye la caja como sólidos reales (B-rep, motor OpenCascade vía replicad),
// para exportar STEP de verdad y, opcionalmente, redondear el borde expuesto de
// cada pieza. Esto es pesado (WASM ~23 MB) y el chaflán es lento en piezas con
// muchos dedos (cada diente es una arista a redondear) — por eso vive aparte
// del preview rápido (caja3d.ts, tres.js puro) y se carga solo bajo demanda.
import type { Sketch, Shape3D } from "replicad"

import type { Pieza } from "./caja"

type Plano = { origen: [number, number, number]; xDir: [number, number, number]; normal: [number, number, number] }

type V = [number, number, number]
const cruz = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// Plano de bosquejo de cada pieza a partir de su ubicación (origen + ejes,
// ver caja.ts). replicad pide una base derecha (normal = xDir × yDir): si la
// ubicación es una reflexión (uz opuesto a ux × uy), el origen se corre un
// espesor sobre uz y se extruye hacia el otro lado; ocupa el mismo lugar.
function planoDe(pieza: Pieza, t: number): Plano {
  const u = pieza.ubicacion || { origen: [0, 0, 0] as V, ux: [1, 0, 0] as V, uy: [0, 1, 0] as V, uz: [0, 0, 1] as V }
  const n = cruz(u.ux, u.uy)
  const mismoLado = n[0] * u.uz[0] + n[1] * u.uz[1] + n[2] * u.uz[2] > 0
  const origen: V = mismoLado ? u.origen : [u.origen[0] + t * u.uz[0], u.origen[1] + t * u.uz[1], u.origen[2] + t * u.uz[2]]
  return { origen, xDir: u.ux, normal: n }
}

// Radio de chaflán más grande que es geométricamente seguro para estas
// piezas: debe ser menor que la mitad del segmento más corto del contorno
// (dedos muy angostos o esquinas de compensación de kerf), si no el motor
// CAD falla al intentar redondear una arista más corta que el propio radio.
export function chaflanMaximo(piezas: Pieza[]): number {
  let minSeg = Infinity
  for (const pieza of piezas) {
    const n = pieza.contorno.length
    for (let i = 0; i < n; i++) {
      const a = pieza.contorno[i]
      const b = pieza.contorno[(i + 1) % n]
      const d = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (d > 1e-6) minSeg = Math.min(minSeg, d)
    }
  }
  return Number.isFinite(minSeg) ? Math.max(0, minSeg / 2 - 0.05) : 0
}

let ocCargado: Promise<void> | null = null

// Carga el motor OpenCascade (WASM, ~23 MB) una sola vez. Debe llamarse antes
// de construirSolidos(); se separa para que la UI pueda mostrar "cargando..."
// mientras esto corre, en vez de que la primera llamada se sienta colgada.
export async function cargarOC(): Promise<void> {
  if (!ocCargado) {
    ocCargado = (async () => {
      const [{ default: initOC }, { setOC }] = await Promise.all([import("replicad-opencascadejs"), import("replicad")])
      const oc = await initOC({ locateFile: () => "/wasm/replicad_single.wasm" })
      setOC(oc)
    })()
  }
  return ocCargado
}

export type PiezaSolida = { nombre: string; shape: Shape3D }

// Construye los 6 (o 5, sin tapa) sólidos de la caja. chaflanMm > 0 redondea
// el borde expuesto (donde la cara plana de cada pieza se encuentra con su
// canto) de cada pieza - como pasar una fresa de redondeo por el contorno ya
// cortado. Es lento con muchos dedos (varios segundos): llamar solo bajo
// pedido explícito del usuario, nunca en cada cambio de un control.
export async function construirSolidos(
  piezas: Pieza[],
  espesor: number,
  _exterior: { ancho: number; fondo: number; alto: number },
  chaflanMm = 0
): Promise<PiezaSolida[]> {
  await cargarOC()
  const { draw, Plane } = await import("replicad")

  const maximo = chaflanMaximo(piezas)
  if (chaflanMm > maximo) {
    throw new Error(
      `El chaflán de ${chaflanMm} mm es más grande de lo que esta geometría permite (hay dedos o esquinas muy angostas). Máximo seguro: ${maximo.toFixed(2)} mm.`
    )
  }

  return piezas.map((pieza) => {
    const { origen, xDir, normal } = planoDe(pieza, espesor)
    const plano = new Plane(origen, xDir, normal)
    const poligono = (pts: [number, number][]) => {
      let pluma = draw(pts[0])
      for (const p of pts.slice(1)) pluma = pluma.lineTo(p)
      return pluma.close()
    }
    let dibujo = poligono(pieza.contorno)
    for (const h of pieza.huecos || []) dibujo = dibujo.cut(poligono(h))
    // un contorno exterior (con o sin huecos) es una sola cara, así que
    // sketchOnPlane() da un Sketch (no Sketches) aquí.
    const sketch = dibujo.sketchOnPlane(plano) as Sketch
    let solido: Shape3D = sketch.extrude(espesor)

    if (chaflanMm > 0) {
      const origenSuperior: [number, number, number] = [
        origen[0] + normal[0] * espesor,
        origen[1] + normal[1] * espesor,
        origen[2] + normal[2] * espesor,
      ]
      solido = solido.fillet(chaflanMm, (f) => f.inPlane(new Plane(origen, xDir, normal)))
      solido = solido.fillet(chaflanMm, (f) => f.inPlane(new Plane(origenSuperior, xDir, normal)))
    }

    return { nombre: pieza.nombre, shape: solido }
  })
}

export async function exportarSTEP(solidos: PiezaSolida[]): Promise<Blob> {
  const { exportSTEP } = await import("replicad")
  return exportSTEP(solidos.map((s) => ({ shape: s.shape, name: s.nombre })))
}
