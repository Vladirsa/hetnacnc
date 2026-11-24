"use client"

// Vista 3D del Simulador CNC: el bloque de material (mapa de alturas con sus
// costados), la fresa y las trayectorias (rápidos en naranja, cortes en azul).
// Se dibuja sólo cuando algo cambia. Ejes: X a la derecha, Y al fondo, Z arriba.
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import type { Material, Movimiento, Punto } from "@/lib/simulador/gcode"
import type { Bloque, Fresa } from "@/lib/simulador/material"

type Props = {
  material: Material
  fresa: Fresa
  bloque: Bloque
  version: number // cambia cada vez que el bloque se corta
  movimientos: Movimiento[]
  herramienta: Punto
  trayectoria: boolean
  alto?: number
}

// G-code (x, y, z) -> three (x, z, -y)
const v3 = (p: Punto) => new THREE.Vector3(p.x, p.z, -p.y)

const COLOR_ARRIBA = new THREE.Color(0xd8b98c) // MDF
const COLOR_FONDO = new THREE.Color(0x7a5a36)

export default function Vista3DSimulador({ material, fresa, bloque, version, movimientos, herramienta, trayectoria, alto = 520 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const st = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    render: () => void
    malla: THREE.Mesh | null
    sup: { pos: THREE.BufferAttribute; col: THREE.BufferAttribute; geo: THREE.BufferGeometry; nTop: number; borde: number[] } | null
    fresa: THREE.Group | null
    lineas: THREE.Group | null
  } | null>(null)

  // Escena: una vez
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f151e)
    const camera = new THREE.PerspectiveCamera(40, Math.max(1, el.clientWidth) / alto, 0.5, 20000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, alto)
    el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(0.6, 1.6, 0.9)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, 0.5, -0.8)
    scene.add(luz2)
    const controles = new OrbitControls(camera, renderer.domElement)
    controles.enableDamping = true
    let pedido = 0
    const render = () => {
      cancelAnimationFrame(pedido)
      pedido = requestAnimationFrame(() => {
        if (controles.update()) render()
        renderer.render(scene, camera)
      })
    }
    controles.addEventListener("change", render)
    const obs = new ResizeObserver(() => {
      const w = el.clientWidth || 300
      camera.aspect = w / alto
      camera.updateProjectionMatrix()
      renderer.setSize(w, alto)
      render()
    })
    obs.observe(el)
    st.current = { scene, camera, render, malla: null, sup: null, fresa: null, lineas: null }
    ;(st.current as any).controles = controles
    return () => {
      obs.disconnect()
      controles.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      st.current = null
    }
  }, [alto])

  // Bloque de material: se rehace al cambiar de material o de bloque
  useEffect(() => {
    const s = st.current
    if (!s) return
    if (s.malla) {
      s.scene.remove(s.malla)
      s.malla.geometry.dispose()
      ;(s.malla.material as THREE.Material).dispose()
    }
    const { nx, ny, celda, x0, y0 } = bloque
    // Cara de arriba (nx*ny vértices) + costados (borde arriba y abajo)
    const borde: number[] = []
    for (let i = 0; i < nx; i++) borde.push(i) // frente (y0)
    for (let j = 1; j < ny; j++) borde.push(j * nx + nx - 1) // derecha
    for (let i = nx - 2; i >= 0; i--) borde.push((ny - 1) * nx + i) // fondo
    for (let j = ny - 2; j >= 1; j--) borde.push(j * nx) // izquierda
    const nTop = nx * ny
    const total = nTop + borde.length * 2
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        pos.set([x0 + i * celda, 0, -(y0 + j * celda)], k * 3)
      }
    borde.forEach((k, b) => {
      const x = pos[k * 3], z = pos[k * 3 + 2]
      pos.set([x, 0, z], (nTop + b * 2) * 3)
      pos.set([x, -bloque.alto, z], (nTop + b * 2 + 1) * 3)
    })
    const idx: number[] = []
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    for (let b = 0; b < borde.length; b++) {
      const a = nTop + b * 2, c = nTop + ((b + 1) % borde.length) * 2
      idx.push(a, a + 1, c, c, a + 1, c + 1)
    }
    const geo = new THREE.BufferGeometry()
    const pAttr = new THREE.BufferAttribute(pos, 3)
    const cAttr = new THREE.BufferAttribute(col, 3)
    geo.setAttribute("position", pAttr)
    geo.setAttribute("color", cAttr)
    geo.setIndex(idx)
    const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }))
    s.scene.add(malla)
    s.malla = malla
    s.sup = { pos: pAttr, col: cAttr, geo, nTop, borde }

    // Cámara al tamaño del material
    const tam = Math.max(material.ancho, material.largo)
    const cx = x0 + material.ancho / 2, cz = -(y0 + material.largo / 2)
    s.camera.position.set(cx + tam * 0.55, tam * 0.95, cz + tam * 1.05)
    const ctl = (s as any).controles as OrbitControls
    ctl.target.set(cx, -material.alto / 2, cz)
    s.camera.lookAt(ctl.target)
    ctl.update()
  }, [bloque, material])

  // Alturas y colores: cada vez que el bloque se corta
  useEffect(() => {
    const s = st.current
    if (!s?.sup) return
    const { pos, col, geo, nTop, borde } = s.sup
    const h = bloque.h
    const c = new THREE.Color()
    for (let k = 0; k < nTop; k++) {
      pos.array[k * 3 + 1] = h[k]
      // Lo cortado siempre se ve más oscuro (aunque sea un grabado de 1 mm) y más entre más hondo
      const prof = -h[k]
      c.copy(COLOR_ARRIBA).lerp(COLOR_FONDO, prof > 0.01 ? Math.min(1, 0.45 + 0.55 * (prof / Math.max(bloque.alto, 1))) : 0)
      ;(col.array as Float32Array).set([c.r, c.g, c.b], k * 3)
    }
    borde.forEach((k, b) => {
      const t = nTop + b * 2
      pos.array[t * 3 + 1] = h[k]
      ;(col.array as Float32Array).set([COLOR_FONDO.r, COLOR_FONDO.g, COLOR_FONDO.b], t * 3)
      ;(col.array as Float32Array).set([COLOR_FONDO.r * 0.8, COLOR_FONDO.g * 0.8, COLOR_FONDO.b * 0.8], (t + 1) * 3)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
    geo.computeVertexNormals()
    s.render()
  }, [version, bloque])

  // Trayectorias
  useEffect(() => {
    const s = st.current
    if (!s) return
    if (s.lineas) {
      s.scene.remove(s.lineas)
      s.lineas.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      s.lineas = null
    }
    if (trayectoria && movimientos.length) {
      const g = new THREE.Group()
      const rapidos: number[] = []
      const cortes: number[] = []
      for (const m of movimientos) {
        const arr = m.tipo === "rapido" ? rapidos : cortes
        for (let i = 1; i < m.puntos.length; i++) {
          const a = v3(m.puntos[i - 1]), b = v3(m.puntos[i])
          arr.push(a.x, a.y + 0.05, a.z, b.x, b.y + 0.05, b.z)
        }
      }
      const linea = (arr: number[], color: number, opacidad: number) => {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3))
        return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad, depthTest: false }))
      }
      if (rapidos.length) g.add(linea(rapidos, 0xff8a2a, 0.55))
      if (cortes.length) g.add(linea(cortes, 0x4fc3ff, 0.75))
      g.renderOrder = 3
      s.scene.add(g)
      s.lineas = g
    }
    s.render()
  }, [movimientos, trayectoria])

  // Fresa: forma según el tipo
  useEffect(() => {
    const s = st.current
    if (!s) return
    if (s.fresa) {
      s.scene.remove(s.fresa)
      s.fresa.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    }
    const r = fresa.diametro / 2
    const g = new THREE.Group()
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9d1d9, metalness: 0.8, roughness: 0.3 })
    const largo = Math.max(20, fresa.diametro * 4)
    if (fresa.tipo === "v") {
      const altoCono = r / Math.tan(((fresa.angulo || 60) * Math.PI) / 360)
      const cono = new THREE.Mesh(new THREE.ConeGeometry(r, altoCono, 32), metal)
      cono.rotation.x = Math.PI
      cono.position.y = altoCono / 2
      g.add(cono)
      const zanco = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 32), metal)
      zanco.position.y = altoCono + largo / 2
      g.add(zanco)
    } else {
      const base = fresa.tipo === "bola" ? r : 0
      if (fresa.tipo === "bola") {
        const bola = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal)
        bola.position.y = r
        g.add(bola)
      }
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 32), metal)
      cuerpo.position.y = base + largo / 2
      g.add(cuerpo)
    }
    s.scene.add(g)
    s.fresa = g
    s.render()
  }, [fresa])

  // Posición de la fresa (la punta en el punto programado)
  useEffect(() => {
    const s = st.current
    if (!s?.fresa) return
    s.fresa.position.copy(v3(herramienta))
    s.render()
  }, [herramienta, fresa])

  return <div ref={ref} className="w-full overflow-hidden rounded-[12px] border border-[#2B3648]" style={{ height: alto }} />
}
