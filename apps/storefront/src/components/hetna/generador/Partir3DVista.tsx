"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import type { Corte } from "@/lib/generador/partir3d"

// Vista de "Partir modelo 3D": el modelo con los planos de corte, o las piezas
// ya partidas y separadas (vista explotada), cada una de un color. Z hacia arriba.
const COLORES = [0xff6a1a, 0x2f80ed, 0x16a34a, 0xf2c94c, 0x9b51e0, 0xeb5757, 0x00a3a3, 0xd97706]

type Props = {
  modelo: number[] | null
  piezas: { nombre: string; tris: number[] }[] | null
  cortes: Corte[]
  separar: number
  alto?: number
}

export default function Partir3DVista({ modelo, piezas, cortes, separar, alto = 460 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const estado = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; grupo: THREE.Group; render: () => void; tam: number; listo: boolean } | null>(null)

  // Escena, cámara y controles: una vez
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f151e)
    const camera = new THREE.PerspectiveCamera(40, Math.max(1, el.clientWidth) / alto, 0.5, 50000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, alto)
    el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const luz = new THREE.DirectionalLight(0xffffff, 1)
    luz.position.set(1, 2, 1.2)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, 0.4, -1)
    scene.add(luz2)
    const grupo = new THREE.Group()
    grupo.rotation.x = -Math.PI / 2 // Z del modelo hacia arriba
    scene.add(grupo)
    const controles = new OrbitControls(camera, renderer.domElement)
    controles.enableDamping = true
    let pedir = 0
    const render = () => {
      cancelAnimationFrame(pedir)
      pedir = requestAnimationFrame(() => {
        controles.update()
        renderer.render(scene, camera)
      })
    }
    controles.addEventListener("change", render)
    const ajustar = () => {
      const w = el.clientWidth || 300
      camera.aspect = w / alto
      camera.updateProjectionMatrix()
      renderer.setSize(w, alto)
      render()
    }
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)
    estado.current = { scene, camera, grupo, render, tam: 0, listo: false }
    return () => {
      obs.disconnect()
      controles.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      estado.current = null
    }
  }, [alto])

  // Contenido: se rehace cuando cambian las piezas, los cortes o la separación
  useEffect(() => {
    const s = estado.current
    if (!s) return
    for (const h of [...s.grupo.children]) {
      s.grupo.remove(h)
      h.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    }
    const base = modelo && modelo.length >= 9 ? modelo : null
    if (!base) return s.render()

    // Caja del modelo completo (centro de la explosión)
    const caja = new THREE.Box3().setFromBufferAttribute(new THREE.Float32BufferAttribute(base, 3))
    const centro = caja.getCenter(new THREE.Vector3())
    const tam = caja.getSize(new THREE.Vector3())

    const malla = (tris: number[], color: number, opaco = 1) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3))
      geo.computeVertexNormals()
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: opaco < 1, opacity: opaco, flatShading: false })
      return new THREE.Mesh(geo, mat)
    }

    if (piezas && piezas.length) {
      piezas.forEach((p, i) => {
        const m = malla(p.tris, COLORES[i % COLORES.length])
        m.geometry.computeBoundingBox()
        const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3())
        // se aleja del centro en los ejes que tienen cortes
        const dir = new THREE.Vector3(...([0, 1, 2].map((e) => (cortes.some((k) => k.eje === e) ? Math.sign(c.getComponent(e) - centro.getComponent(e)) : 0)) as [number, number, number]))
        m.position.copy(dir.multiplyScalar(separar))
        m.position.sub(centro)
        s.grupo.add(m)
      })
    } else {
      const m = malla(base, 0xb9b3a6)
      m.position.sub(centro)
      s.grupo.add(m)
      // planos de corte, un poco más grandes que el modelo
      for (const k of cortes) {
        const ancho = k.eje === 0 ? tam.y : tam.x
        const altoP = k.eje === 2 ? tam.y : tam.z
        const plano = new THREE.Mesh(
          new THREE.PlaneGeometry(ancho * 1.15 + 6, altoP * 1.15 + 6),
          new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
        )
        if (k.eje === 0) plano.rotation.set(Math.PI / 2, Math.PI / 2, 0)
        else if (k.eje === 1) plano.rotation.set(Math.PI / 2, 0, 0)
        const p = centro.clone()
        p.setComponent(k.eje, k.pos)
        plano.position.copy(p.sub(centro))
        s.grupo.add(plano)
      }
    }

    // Cámara: sólo al cambiar de modelo (para no perder el giro del usuario)
    const largo = tam.length() + (piezas?.length ? separar * 2 : 0)
    if (!s.listo || Math.abs(largo - s.tam) / Math.max(1, s.tam) > 0.25) {
      const vfov = (s.camera.fov * Math.PI) / 180
      const dist = (largo / 2 / Math.sin(vfov / 2)) * 1.1
      s.camera.position.copy(new THREE.Vector3(0.9, 0.75, 1).normalize().multiplyScalar(dist))
      s.camera.lookAt(0, 0, 0)
      s.tam = largo
      s.listo = true
    }
    s.render()
  }, [modelo, piezas, cortes, separar])

  return <div ref={ref} className="w-full rounded-[12px] overflow-hidden border border-[#2B3648]" style={{ height: alto }} />
}
