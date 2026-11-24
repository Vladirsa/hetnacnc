"use client"

// Vista 3D del Simulador de torno CNC: la barra que gira (el perfil revolucionado),
// el chuck, el inserto y las trayectorias. Ejes de la vista: Z del torno a lo
// largo (a la derecha está la cara de la pieza), X del torno hacia arriba.
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import type { Barra, MovimientoT, Perfil, PuntoT } from "@/lib/simulador/torno"

type Props = {
  barra: Barra
  perfil: Perfil
  version: number
  movimientos: MovimientoT[]
  herramienta: PuntoT
  trayectoria: boolean
  girando: boolean
  alto?: number
}

const LADOS = 64
const MAX_ANILLOS = 500
// torno (z, x radio) -> three (z, x, 0): la trayectoria se dibuja en el plano de enfrente
const v3 = (p: PuntoT) => new THREE.Vector3(p.z, p.x, 0)

export default function Vista3DTorno({ barra, perfil, version, movimientos, herramienta, trayectoria, girando, alto = 520 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const st = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    render: () => void
    pieza: THREE.Mesh | null
    anillos: number[]
    lineas: THREE.Group | null
    inserto: THREE.Group | null
    giro: { activo: boolean }
  } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f151e)
    const camera = new THREE.PerspectiveCamera(38, Math.max(1, el.clientWidth) / alto, 0.5, 20000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, alto)
    el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(0.4, 1.4, 1.2)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, -0.4, -0.8)
    scene.add(luz2)
    const controles = new OrbitControls(camera, renderer.domElement)
    controles.enableDamping = true
    const giro = { activo: false }
    let pedido = 0
    const render = () => {
      cancelAnimationFrame(pedido)
      pedido = requestAnimationFrame(() => {
        const s = st.current
        if (giro.activo && s?.pieza) s.pieza.rotation.x += 0.25
        const sigue = controles.update()
        renderer.render(scene, camera)
        if (sigue || giro.activo) render()
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
    st.current = { scene, camera, render, pieza: null, anillos: [], lineas: null, inserto: null, giro }
    ;(st.current as any).controles = controles
    return () => {
      obs.disconnect()
      controles.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      st.current = null
    }
  }, [alto])

  // Pieza (malla revolucionada) y chuck: al cambiar la barra
  useEffect(() => {
    const s = st.current
    if (!s) return
    for (const o of [...s.scene.children]) if ((o as any).userData?.fija) {
      s.scene.remove(o)
      o.traverse((c: any) => { c.geometry?.dispose?.(); c.material?.dispose?.() })
    }
    // anillos: muestreo del perfil (hasta MAX_ANILLOS) + tapas
    const paso = Math.max(1, Math.ceil(perfil.n / MAX_ANILLOS))
    const anillos: number[] = []
    for (let i = 0; i < perfil.n; i += paso) anillos.push(i)
    if (anillos[anillos.length - 1] !== perfil.n - 1) anillos.push(perfil.n - 1)
    const nA = anillos.length
    const pos = new Float32Array((nA * LADOS + 2) * 3)
    const idx: number[] = []
    for (let a = 0; a < nA - 1; a++)
      for (let k = 0; k < LADOS; k++) {
        const i0 = a * LADOS + k, i1 = a * LADOS + ((k + 1) % LADOS)
        const j0 = (a + 1) * LADOS + k, j1 = (a + 1) * LADOS + ((k + 1) % LADOS)
        idx.push(i0, j0, i1, i1, j0, j1)
      }
    const cCara = nA * LADOS, cAtras = nA * LADOS + 1 // centros de las tapas
    for (let k = 0; k < LADOS; k++) {
      idx.push(cCara, k, (k + 1) % LADOS)
      idx.push(cAtras, (nA - 1) * LADOS + ((k + 1) % LADOS), (nA - 1) * LADOS + k)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setIndex(idx)
    const pieza = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.75, roughness: 0.32, side: THREE.DoubleSide }))
    pieza.userData.fija = true
    s.scene.add(pieza)
    s.pieza = pieza
    s.anillos = anillos

    // Chuck con 3 mordazas al final de la barra
    const R = barra.diametro / 2
    const chuck = new THREE.Group()
    chuck.userData.fija = true
    const metalOscuro = new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.6, roughness: 0.45 })
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.4, R * 2.4, R * 1.4, 48), metalOscuro)
    cuerpo.rotation.z = Math.PI / 2
    cuerpo.position.x = -barra.largo - R * 0.7
    chuck.add(cuerpo)
    for (let k = 0; k < 3; k++) {
      const mordaza = new THREE.Mesh(new THREE.BoxGeometry(R * 0.9, R * 0.7, R * 0.7), metalOscuro)
      const ang = (k * 2 * Math.PI) / 3
      mordaza.position.set(-barra.largo + R * 0.1, Math.cos(ang) * (R + R * 0.35), Math.sin(ang) * (R + R * 0.35))
      chuck.add(mordaza)
    }
    s.scene.add(chuck)

    // Cámara
    const tam = Math.max(barra.largo, barra.diametro * 2)
    const ctl = (s as any).controles as OrbitControls
    ctl.target.set(-barra.largo / 2 + 8, barra.diametro * 0.25, 0)
    s.camera.position.set(-barra.largo / 2 + tam * 0.55, tam * 0.75, tam * 1.75)
    s.camera.lookAt(ctl.target)
    ctl.update()
  }, [barra, perfil])

  // Radios: cada vez que se corta
  useEffect(() => {
    const s = st.current
    if (!s?.pieza) return
    const geo = s.pieza.geometry as THREE.BufferGeometry
    const pos = geo.getAttribute("position") as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    s.anillos.forEach((i, a) => {
      const z = -i * perfil.paso
      const r = perfil.r[i]
      for (let k = 0; k < LADOS; k++) {
        const ang = (k / LADOS) * Math.PI * 2
        arr.set([z, Math.cos(ang) * r, Math.sin(ang) * r], (a * LADOS + k) * 3)
      }
    })
    const nA = s.anillos.length
    arr.set([0, 0, 0], nA * LADOS * 3)
    arr.set([-perfil.largo, 0, 0], (nA * LADOS + 1) * 3)
    pos.needsUpdate = true
    geo.computeVertexNormals()
    s.render()
  }, [version, perfil])

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
      const rap: number[] = [], cor: number[] = []
      for (const m of movimientos) {
        const arr = m.tipo === "rapido" ? rap : cor
        for (let i = 1; i < m.puntos.length; i++) {
          const a = v3(m.puntos[i - 1]), b = v3(m.puntos[i])
          arr.push(a.x, a.y, 0.2, b.x, b.y, 0.2)
        }
      }
      const linea = (arr: number[], color: number, op: number) => {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3))
        return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthTest: false }))
      }
      if (rap.length) g.add(linea(rap, 0xff8a2a, 0.6))
      if (cor.length) g.add(linea(cor, 0x4fc3ff, 0.85))
      g.renderOrder = 3
      s.scene.add(g)
      s.lineas = g
    }
    s.render()
  }, [movimientos, trayectoria])

  // Inserto (rombo de 80°) con su porta-herramienta
  useEffect(() => {
    const s = st.current
    if (!s || s.inserto) return
    const g = new THREE.Group()
    const forma = new THREE.Shape()
    forma.moveTo(0, 0)
    forma.lineTo(4, 6)
    forma.lineTo(0, 12)
    forma.lineTo(-4, 6)
    forma.closePath()
    const inserto = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 3, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 }))
    inserto.position.z = -1.5
    g.add(inserto)
    const porta = new THREE.Mesh(new THREE.BoxGeometry(10, 40, 8), new THREE.MeshStandardMaterial({ color: 0x5b6779, metalness: 0.5, roughness: 0.5 }))
    porta.position.set(0, 30, 0)
    g.add(porta)
    s.scene.add(g)
    s.inserto = g
    s.render()
  }, [])

  useEffect(() => {
    const s = st.current
    if (!s?.inserto) return
    s.inserto.position.copy(v3(herramienta))
    s.render()
  }, [herramienta])

  useEffect(() => {
    const s = st.current
    if (!s) return
    s.giro.activo = girando
    s.render()
  }, [girando])

  return <div ref={ref} className="w-full overflow-hidden rounded-[12px] border border-[#2B3648]" style={{ height: alto }} />
}
