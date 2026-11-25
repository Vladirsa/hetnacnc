// Aparte de Controles.tsx para que las herramientas 2D (que usan los
// controles) no bajen three.js entero por esta sola función.
import * as THREE from "three"

/** Pasa un grupo de three.js (con sus transformaciones) a triángulos sueltos. */
export function grupoATris(grupo: THREE.Object3D): number[] {
  const tris: number[] = []
  grupo.updateMatrixWorld(true)
  const v = new THREE.Vector3()
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    const pos = g.getAttribute("position")
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      tris.push(v.x, v.y, v.z)
    }
  })
  return tris
}
