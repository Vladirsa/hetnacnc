"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { piezasAGrupo3D } from "@/lib/generador/caja3d"
import type { Pieza } from "@/lib/generador/caja"

type Props = {
  piezas: Pieza[]
  espesor: number
  exterior: { ancho: number; fondo: number; alto: number }
}

export default function Caja3D({ piezas, espesor, exterior }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || piezas.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf7f3ee)

    const camera = new THREE.PerspectiveCamera(45, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 1, 10000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
    el.appendChild(renderer.domElement)

    const grupo = piezasAGrupo3D(piezas, espesor, exterior)
    const caja = new THREE.Box3().setFromObject(grupo)
    const centro = caja.getCenter(new THREE.Vector3())
    grupo.position.sub(centro)
    scene.add(grupo)

    const tam = caja.getSize(new THREE.Vector3()).length() || 1
    // Distancia justa para que la caja llene la vista sin salirse
    const r = tam / 2
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const dist = Math.max(r / Math.sin(vfov / 2), r / Math.sin(hfov / 2)) * 1.05
    camera.position.copy(new THREE.Vector3(0.7, 0.5, 0.8).normalize().multiplyScalar(dist))
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const luz = new THREE.DirectionalLight(0xffffff, 0.9)
    luz.position.set(1, 2, 1)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, 0.5, -1)
    scene.add(luz2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)

    let activo = true
    const animar = () => {
      if (!activo) return
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animar)
    }
    animar()

    const onResize = () => {
      const w = el.clientWidth || 300
      const h = el.clientHeight || 300
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    return () => {
      activo = false
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [piezas, espesor, exterior])

  // El alto lo pone el contenedor (Visor3D); si va suelto, 420 px
  return <div ref={ref} className="w-full h-[420px] rounded-[12px] overflow-hidden cursor-grab active:cursor-grabbing" />
}
