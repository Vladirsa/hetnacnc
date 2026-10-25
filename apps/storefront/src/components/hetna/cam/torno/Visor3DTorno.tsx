"use client"

// Vista 3D de la pieza torneada, con estrías y espiral si las tiene.
// La forma sale de lib/torno/pieza.ts (radioTalladoEn): la misma fuente que
// usa el generador de G-code.

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { longitudTotal, radioMaximo, radioTalladoEn, type Segmento, type Tallados } from "@/lib/torno/pieza"

type Props = {
  segmentos: Segmento[]
  tallados: Tallados
  anchoFresa: number
  bloque: number
  /** cambia cada vez que se abre otro ejemplo o diseño: vuelve a encuadrar la cámara */
  encuadre: number
}

function construirMalla(segmentos: Segmento[], tallados: Tallados, anchoFresa: number) {
  const largo = longitudTotal(segmentos)
  const conTallado = Boolean(tallados.estrias?.activo || tallados.espiral?.activo)
  const nY = Math.min(600, Math.max(80, Math.round(largo / (conTallado ? 1 : 2))))
  const nT = conTallado ? 180 : 72
  const pos = new Float32Array((nY + 1) * (nT + 1) * 3)
  let i = 0
  for (let iy = 0; iy <= nY; iy++) {
    const y = (largo * iy) / nY
    for (let it = 0; it <= nT; it++) {
      const ang = (360 * it) / nT
      const r = radioTalladoEn(y, ang, segmentos, tallados, anchoFresa)
      const rad = (ang * Math.PI) / 180
      // eje de la pieza sobre X; la vista queda acostada, como en la máquina
      pos[i++] = y - largo / 2
      pos[i++] = r * Math.cos(rad)
      pos[i++] = r * Math.sin(rad)
    }
  }
  const indices: number[] = []
  for (let iy = 0; iy < nY; iy++) {
    for (let it = 0; it < nT; it++) {
      const a = iy * (nT + 1) + it
      const b = a + nT + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return { geo, largo }
}

// Tapas de los extremos (para que la pieza no se vea hueca)
function tapas(segmentos: Segmento[], largo: number, material: THREE.Material) {
  const grupo = new THREE.Group()
  for (const [y, lado] of [
    [0, -1],
    [largo, 1],
  ] as const) {
    const r = segmentos.length ? radioTalladoEn(y, 0, segmentos, {}, 1) : 1
    const disco = new THREE.Mesh(new THREE.CircleGeometry(r, 72), material)
    disco.rotation.y = (lado * Math.PI) / 2
    disco.position.x = y - largo / 2
    grupo.add(disco)
  }
  return grupo
}

export default function Visor3DTorno({ segmentos, tallados, anchoFresa, bloque, encuadre }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const escena = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    pieza: THREE.Group | null
    encuadre: number | null
  } | null>(null)

  // Escena, cámara y renderizador: una sola vez
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf7f5ef)
    const camera = new THREE.PerspectiveCamera(35, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 1, 20000)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      el.textContent = "Tu navegador no puede mostrar la vista 3D. Usa la pestaña Perfil."
      return
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
    el.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.9))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(0.6, 1, 0.8)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.35)
    luz2.position.set(-1, -0.4, -0.6)
    scene.add(luz2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    escena.current = { scene, camera, controls, pieza: null, encuadre: null }

    let activo = true
    const animar = () => {
      if (!activo) return
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animar)
    }
    animar()

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 300
      const h = el.clientHeight || 300
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    return () => {
      activo = false
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      escena.current = null
      el.innerHTML = ""
    }
  }, [])

  // La pieza: se rehace cuando cambia el diseño (con una pausa corta para no
  // recalcular en cada tecla)
  useEffect(() => {
    const t = setTimeout(() => {
      const e = escena.current
      if (!e) return
      const validos = segmentos.filter(
        (s) => [s.inicioY, s.finY, s.radioInicio, s.radioFin].every(Number.isFinite) && s.finY > s.inicioY && s.radioInicio > 0 && s.radioFin > 0
      )
      if (e.pieza) {
        e.scene.remove(e.pieza)
        e.pieza.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
            o.geometry.dispose()
            ;(o.material as THREE.Material).dispose()
          }
        })
        e.pieza = null
      }
      if (!validos.length || longitudTotal(validos) <= 0) return

      const madera = new THREE.MeshStandardMaterial({ color: 0xd9a46a, roughness: 0.75, metalness: 0.02, side: THREE.DoubleSide })
      const { geo, largo } = construirMalla(validos, tallados, Math.max(1, anchoFresa || 6))
      const grupo = new THREE.Group()
      grupo.add(new THREE.Mesh(geo, madera))
      grupo.add(tapas(validos, largo, madera))

      // el bloque cuadrado original, en líneas
      if (bloque > 0) {
        const caja = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(largo, bloque, bloque)),
          new THREE.LineBasicMaterial({ color: 0xa5a29a, transparent: true, opacity: 0.6 })
        )
        grupo.add(caja)
      }
      e.scene.add(grupo)
      e.pieza = grupo

      // Se encuadra al abrir otro ejemplo o diseño (cambia `encuadre`) y la
      // primera vez; al editar medidas la cámara se queda donde la dejó el usuario.
      if (e.encuadre !== encuadre) {
        // que el largo quepa a lo ancho y el grueso a lo alto (en celular la vista es angosta)
        const alto = Math.max(bloque, radioMaximo(validos) * 2)
        const vfov = (e.camera.fov * Math.PI) / 180
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * e.camera.aspect)
        const dist = Math.max((largo / 2 / Math.tan(hfov / 2)) * 1.3, (alto / 2 / Math.tan(vfov / 2)) * 1.8)
        e.camera.position.set(0, dist * 0.38, dist * 0.92)
        e.camera.lookAt(0, 0, 0)
        e.controls.target.set(0, 0, 0)
        e.encuadre = encuadre
      }
    }, 150)
    return () => clearTimeout(t)
  }, [segmentos, tallados, anchoFresa, bloque, encuadre])

  return (
    <div
      ref={ref}
      className="h-[260px] w-full overflow-hidden rounded-[10px] bg-[#F7F5EF] text-[13px] text-[#6B6A63] sm:h-[320px]"
      aria-label="Vista 3D de la pieza"
    />
  )
}
