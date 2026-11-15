// Convierte las piezas 2D de la caja (contornos con dedos) en una malla 3D
// armada, para la vista previa del generador. Cada pieza se extruye por su
// espesor con three.js (Shape + ExtrudeGeometry, que ya triangula contornos
// no convexos como los dedos, y los huecos de asas y ranuras) y luego se
// ubica en su lugar con el mapeo lineal que trae la propia pieza (origen + 3
// ejes), en vez de rotaciones de Euler: intercambiar ejes locales por
// mundiales puede ser una reflexión (la tapa sobrepuesta va de cabeza), y una
// Euler no la representa. computeVertexNormals() recalcula la iluminación.
import * as THREE from "three"

import type { Pieza } from "./caja"

export function piezasAGrupo3D(
  piezas: Pieza[],
  espesor: number,
  _exterior?: { ancho: number; fondo: number; alto: number },
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
    for (const h of pieza.huecos || []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    const geo = new THREE.ExtrudeGeometry(shape, { depth: espesor, bevelEnabled: false, curveSegments: 1 })

    const u = pieza.ubicacion || { origen: [0, 0, 0], ux: [1, 0, 0], uy: [0, 1, 0], uz: [0, 0, 1] }
    const O = new THREE.Vector3(...u.origen)
    const UX = new THREE.Vector3(...u.ux)
    const UY = new THREE.Vector3(...u.uy)
    const UZ = new THREE.Vector3(...u.uz)

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
