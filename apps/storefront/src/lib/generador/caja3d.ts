// Convierte las piezas 2D de la caja (contornos con dedos) en una malla 3D
// armada, para la vista previa del generador. Cada pieza se extruye por su
// espesor con three.js (Shape + ExtrudeGeometry, que ya triangula contornos
// no convexos como los dedos) y luego se ubica en su lugar dentro de la caja
// con un mapeo lineal propio (origen + 3 ejes), en vez de rotaciones de
// Euler: intercambiar ejes locales por mundiales es una reflexión, no una
// rotación, así que una Euler no puede dar el resultado exacto en todas las
// piezas. computeVertexNormals() recalcula la iluminación después, así que
// el signo de ese mapeo no importa.
import * as THREE from "three"

import type { Pieza } from "./caja"

type Vec3 = [number, number, number]
type Ubicacion = { origen: Vec3; ux: Vec3; uy: Vec3; uz: Vec3 }

function ubicacionDe(nombre: string, espesor: number, ext: { ancho: number; fondo: number; alto: number }): Ubicacion {
  const { ancho: W, fondo: D, alto: H } = ext
  const t = espesor
  switch (nombre) {
    case "Base":
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 0, 1], uz: [0, 1, 0] }
    case "Tapa":
      return { origen: [0, H - t, 0], ux: [1, 0, 0], uy: [0, 0, 1], uz: [0, 1, 0] }
    case "Frente":
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
    case "Atrás":
      return { origen: [0, 0, D - t], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
    case "Lateral izquierdo":
      return { origen: [0, 0, 0], ux: [0, 0, 1], uy: [0, 1, 0], uz: [1, 0, 0] }
    case "Lateral derecho":
      return { origen: [W - t, 0, 0], ux: [0, 0, 1], uy: [0, 1, 0], uz: [1, 0, 0] }
    default:
      return { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
  }
}

export function piezasAGrupo3D(
  piezas: Pieza[],
  espesor: number,
  exterior: { ancho: number; fondo: number; alto: number },
  color = 0xd8a86b
): THREE.Group {
  const grupo = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.05,
  })

  for (const pieza of piezas) {
    const shape = new THREE.Shape(pieza.contorno.map(([x, y]) => new THREE.Vector2(x, y)))
    const geo = new THREE.ExtrudeGeometry(shape, { depth: espesor, bevelEnabled: false, curveSegments: 1 })

    const { origen, ux, uy, uz } = ubicacionDe(pieza.nombre, espesor, exterior)
    const O = new THREE.Vector3(...origen)
    const UX = new THREE.Vector3(...ux)
    const UY = new THREE.Vector3(...uy)
    const UZ = new THREE.Vector3(...uz)

    const pos = geo.attributes.position
    const w = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      w.copy(O)
        .addScaledVector(UX, pos.getX(i))
        .addScaledVector(UY, pos.getY(i))
        .addScaledVector(UZ, pos.getZ(i))
      pos.setXYZ(i, w.x, w.y, w.z)
    }
    geo.computeVertexNormals()

    const mesh = new THREE.Mesh(geo, material)
    mesh.name = pieza.nombre
    grupo.add(mesh)
  }

  return grupo
}
