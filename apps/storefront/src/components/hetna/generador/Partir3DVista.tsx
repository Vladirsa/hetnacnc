"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import type { Corte, Marca } from "@/lib/generador/partir3d"

// Vista de "Partir modelo 3D". Dos modos:
//  · "piezas": las piezas ya partidas y separadas (vista explotada), cada una de un color
//  · "cortes": el modelo translúcido con los planos de corte y cada perno o imán dibujado;
//    tocando el modelo (sin arrastrar) se avisa el punto para agregar un corte ahí.
// Z hacia arriba.
const COLORES = [0xff6a1a, 0x2f80ed, 0x16a34a, 0xf2c94c, 0x9b51e0, 0xeb5757, 0x00a3a3, 0xd97706]

type Props = {
  modelo: number[] | null
  piezas: { nombre: string; tris: number[] }[] | null
  cortes: Corte[]
  marcas?: Marca[]
  modo?: "piezas" | "cortes"
  separar: number
  alto?: number
  /** Punto del modelo (mm) donde se tocó, en modo "cortes". */
  alTocar?: (p: [number, number, number]) => void
}

export default function Partir3DVista({ modelo, piezas, cortes, marcas = [], modo = "piezas", separar, alto = 460, alTocar }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // piezas escondidas en la vista explotada (para ver los pernos o coples de las de atrás)
  const [ocultas, setOcultas] = useState<number[]>([])
  useEffect(() => setOcultas([]), [piezas])
  const tocar = useRef(alTocar)
  tocar.current = alTocar
  const estado = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; grupo: THREE.Group; render: () => void; tam: number; listo: boolean; blanco: THREE.Mesh | null } | null>(null)

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

    // Tocar (sin arrastrar) el modelo: punto en milímetros del modelo
    let abajo: { x: number; y: number } | null = null
    const rayo = new THREE.Raycaster()
    const alBajar = (e: PointerEvent) => { abajo = { x: e.clientX, y: e.clientY } }
    const alSubir = (e: PointerEvent) => {
      const s = estado.current
      if (!abajo || !s?.blanco || !tocar.current) return
      const movio = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y)
      abajo = null
      if (movio > 6) return
      const r = renderer.domElement.getBoundingClientRect()
      rayo.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = rayo.intersectObject(s.blanco, false)[0]
      if (!hit) return
      const p = s.blanco.worldToLocal(hit.point.clone())
      tocar.current([p.x, p.y, p.z])
    }
    renderer.domElement.addEventListener("pointerdown", alBajar)
    renderer.domElement.addEventListener("pointerup", alSubir)

    estado.current = { scene, camera, grupo, render, tam: 0, listo: false, blanco: null }
    return () => {
      obs.disconnect()
      renderer.domElement.removeEventListener("pointerdown", alBajar)
      renderer.domElement.removeEventListener("pointerup", alSubir)
      controles.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      estado.current = null
    }
  }, [alto])

  // Contenido: se rehace cuando cambian las piezas, los cortes, los pernos o el modo
  useEffect(() => {
    const s = estado.current
    if (!s) return
    for (const h of [...s.grupo.children]) {
      s.grupo.remove(h)
      h.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    }
    s.blanco = null
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
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: opaco < 1, opacity: opaco, depthWrite: opaco >= 1 })
      return new THREE.Mesh(geo, mat)
    }

    const explotado = modo === "piezas" && piezas && piezas.length > 1
    if (explotado) {
      piezas!.forEach((p, i) => {
        if (ocultas.includes(i)) return
        const m = malla(p.tris, COLORES[i % COLORES.length])
        m.geometry.computeBoundingBox()
        const c = m.geometry.boundingBox!.getCenter(new THREE.Vector3())
        // cada pieza se corre según cuántos cortes tiene antes en cada eje (así se separan
        // también las que quedan del mismo lado del centro), centrado en el modelo
        const corrida = [0, 1, 2].map((e) => {
          const pos = cortes.filter((k) => k.eje === e).map((k) => k.pos)
          if (!pos.length) return 0
          const antes = pos.filter((p) => p < c.getComponent(e)).length
          return (antes - pos.length / 2) * separar
        }) as [number, number, number]
        m.position.set(...corrida)
        m.position.sub(centro)
        s.grupo.add(m)
      })
    } else {
      const conPernos = marcas.length > 0
      const m = malla(base, 0xb9b3a6, conPernos ? 0.45 : 1)
      m.position.sub(centro)
      s.grupo.add(m)
      s.blanco = m
      // planos de corte, un poco más grandes que el modelo
      for (const k of cortes) {
        const ancho = k.eje === 0 ? tam.y : tam.x
        const altoP = k.eje === 2 ? tam.y : tam.z
        const plano = new THREE.Mesh(
          new THREE.PlaneGeometry(ancho * 1.15 + 6, altoP * 1.15 + 6),
          new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: conPernos ? 0.12 : 0.22, side: THREE.DoubleSide, depthWrite: false })
        )
        if (k.eje === 0) plano.rotation.set(Math.PI / 2, Math.PI / 2, 0)
        else if (k.eje === 1) plano.rotation.set(Math.PI / 2, 0, 0)
        const p = centro.clone()
        p.setComponent(k.eje, k.pos)
        plano.position.copy(p.sub(centro))
        s.grupo.add(plano)
      }
      // pernos / imanes: cilindros a lo largo del eje de su corte
      // en modelos grandes se dibujan un poco más gruesos para que se vean (sólo en pantalla)
      const matPerno = new THREE.MeshBasicMaterial({ color: 0x3dff8b, depthTest: false })
      const minR = tam.length() * 0.007, minL = tam.length() * 0.035
      for (const mk of marcas) {
        const cil = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(mk.radio, minR), Math.max(mk.radio, minR), Math.max(2 * mk.mitad, minL), 16), matPerno)
        cil.renderOrder = 2 // encima del modelo translúcido
        // CylinderGeometry va a lo largo de Y: se gira hacia el eje del corte
        if (mk.eje === 0) cil.rotation.z = Math.PI / 2
        else if (mk.eje === 2) cil.rotation.x = Math.PI / 2
        cil.position.set(mk.p[0] - centro.x, mk.p[1] - centro.y, mk.p[2] - centro.z)
        s.grupo.add(cil)
      }
    }

    // Cámara: sólo al cambiar de modelo (para no perder el giro del usuario)
    const largo = tam.length() + (explotado ? separar * 2 : 0)
    if (!s.listo || Math.abs(largo - s.tam) / Math.max(1, s.tam) > 0.25) {
      const vfov = (s.camera.fov * Math.PI) / 180
      const dist = (largo / 2 / Math.sin(vfov / 2)) * 1.1
      s.camera.position.copy(new THREE.Vector3(0.9, 0.75, 1).normalize().multiplyScalar(dist))
      s.camera.lookAt(0, 0, 0)
      s.tam = largo
      s.listo = true
    }
    s.render()
  }, [modelo, piezas, cortes, marcas, modo, separar, ocultas])

  const explotada = modo === "piezas" && !!piezas && piezas.length > 1
  return (
    <div className="relative">
      <div ref={ref} className={`w-full rounded-[12px] overflow-hidden border border-[#2B3648] ${alTocar && modo === "cortes" ? "cursor-crosshair" : ""}`} style={{ height: alto }} />
      {explotada && (
        // ocultar o mostrar cada pieza (Vlado, 28 nov 2026): así se ven los pernos y coples
        <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 overflow-x-auto rounded-[10px] bg-[#0B0F15]/85 p-1.5" role="group" aria-label="Mostrar u ocultar piezas">
          {piezas!.map((p, i) => {
            const oculta = ocultas.includes(i)
            return (
              <button
                key={i}
                type="button"
                aria-pressed={!oculta}
                onClick={() => setOcultas((o) => (oculta ? o.filter((x) => x !== i) : [...o, i]))}
                className={`flex shrink-0 items-center gap-1.5 rounded-[7px] px-2 py-1 text-[12px] font-semibold ${oculta ? "bg-[#1C2431] text-[#6B778A] line-through" : "bg-[#243045] text-white"}`}
                title={oculta ? "Mostrar pieza" : "Ocultar pieza"}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `#${COLORES[i % COLORES.length].toString(16).padStart(6, "0")}`, opacity: oculta ? 0.35 : 1 }} />
                {p.nombre || `Pieza ${i + 1}`}
              </button>
            )
          })}
          {ocultas.length > 0 && (
            <button type="button" onClick={() => setOcultas([])} className="shrink-0 rounded-[7px] px-2 py-1 text-[12px] font-semibold text-[#F28A3C] underline">
              Ver todas
            </button>
          )}
        </div>
      )}
    </div>
  )
}
