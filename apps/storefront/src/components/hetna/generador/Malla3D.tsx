"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

// Vista 3D de una malla de triángulos (9 números por triángulo, en mm, Z hacia
// arriba). La usan las herramientas que producen STL: extruir, litofanías…

// Sin `alto` llena el contenedor (Visor3D); con `alto` mide eso en px.
export default function Malla3D({ tris, alto }: { tris: number[]; alto?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || tris.length < 9) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf7f3ee)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3))
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })
    const malla = new THREE.Mesh(geo, mat)
    // el dibujo está en XY con Z arriba; three mira con Y arriba
    malla.rotation.x = -Math.PI / 2
    const grupo = new THREE.Group()
    grupo.add(malla)
    const caja = new THREE.Box3().setFromObject(grupo)
    const centro = caja.getCenter(new THREE.Vector3())
    grupo.position.sub(centro)
    scene.add(grupo)

    const tam = caja.getSize(new THREE.Vector3()).length() || 1
    const rejilla = new THREE.GridHelper(Math.ceil(tam * 1.5), 20, 0xd9d5c9, 0xe7e4dc)
    rejilla.position.y = -caja.getSize(new THREE.Vector3()).y / 2 - 0.5
    scene.add(rejilla)

    const camera = new THREE.PerspectiveCamera(42, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 0.5, 20000)
    // Distancia justa para que la pieza llene la vista sin salirse
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const dist = Math.max(tam / 2 / Math.sin(vfov / 2), tam / 2 / Math.sin(hfov / 2)) * 1.05
    camera.position.copy(new THREE.Vector3(0.8, 0.7, 0.9).normalize().multiplyScalar(dist))
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
    el.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const luz = new THREE.DirectionalLight(0xffffff, 1)
    luz.position.set(1, 2, 1)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, 0.5, -1)
    scene.add(luz2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

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
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [tris])

  return <div ref={ref} style={alto ? { height: alto } : undefined} className="w-full h-full min-h-[300px] rounded-[12px] overflow-hidden cursor-grab active:cursor-grabbing" />
}
