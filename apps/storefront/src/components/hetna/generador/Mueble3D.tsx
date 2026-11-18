"use client"

// Mueble armado en 3D, pieza por pieza, y editor tipo SketchUp.
//
// - Cada pieza es su contorno real extruido (espigas, mortajas, alivios) con su
//   propio color y aristas marcadas, para que las uniones se lean bien.
// - Explotar separa las piezas sobre su grosor: se ven las espigas salir de
//   las mortajas. Rayos X deja ver a través del mueble.
// - Tocar una pieza la selecciona (y guarda el punto tocado, para agregar
//   repisas o huecos ahí). Con una pieza seleccionada, arrastrar una de sus
//   caras la empuja o la jala; si es la cara grande, mueve el tablero completo.
//
// Ejes del mueble: X ancho, Y fondo (0 = frente), Z alto. three usa Y arriba:
// (x, y, z) del mueble → (x, z, -y).

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import { aMueble, type PiezaEnsamble } from "@/lib/generador/ensamble"

type Eje = 0 | 1 | 2
type Pt = [number, number, number]
export type PiezaVista = PiezaEnsamble & { indice: number }
export type CajaVista = { lo: Pt; hi: Pt }

const COLOR: Record<string, number> = { lateral: 0xd6b48a, horizontal: 0xe8cfa6, frontal: 0xc7a175 }
const SELECCION = 0xff8a3d
const aThree = (p: Pt) => new THREE.Vector3(p[0], p[2], -p[1])
const deThree = (v: THREE.Vector3): Pt => [v.x, -v.z, v.y]

async function geometrias(piezas: PiezaVista[]) {
  const { extruir } = await import("@/lib/generador/extruir")
  return piezas.map((p) => {
    const r = extruir(
      { trazos: [{ pts: p.contorno, cerrado: true, capa: "c" }, ...p.huecos.map((h) => ({ pts: h, cerrado: true, capa: "c" }))], avisos: [], unidades: "mm" },
      { alto: p.grosor, base: 0, margenBase: 0, redondearBase: 0, espejo: false },
    )
    const t = r.malla.tris
    const pos = new Float32Array(t.length)
    for (let i = 0; i < t.length; i += 3) {
      const q = aMueble(p, t[i], t[i + 1], t[i + 2])
      pos[i] = q[0]
      pos[i + 1] = q[2]
      pos[i + 2] = -q[1]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.computeVertexNormals()
    g.computeBoundingBox()
    return g
  })
}

export default function Mueble3D({
  piezas,
  sueltos = [],
  seleccion,
  explotar = 0,
  rayosX = false,
  editable = false,
  ajustar = 0,
  punto,
  alSeleccionar,
  alEmpujar,
  cajaDe,
}: {
  piezas: PiezaVista[]
  sueltos?: CajaVista[] // tableros que no tocan al mueble (se muestran en rojo)
  seleccion: number | null // índice de la pieza
  explotar?: number // 0 a 1
  rayosX?: boolean
  editable?: boolean
  ajustar?: number // cambiarlo vuelve a encuadrar la cámara
  punto?: Pt | null
  alSeleccionar?: (indice: number | null, punto: Pt | null) => void
  alEmpujar?: (indice: number, eje: Eje, lado: 0 | 1, delta: number) => void
  cajaDe?: (indice: number) => CajaVista | null // caja del tablero (para la vista previa al arrastrar)
}) {
  const ref = useRef<HTMLDivElement>(null)
  const st = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    grupo: THREE.Group
    extras: THREE.Group
    fantasma: THREE.Mesh
    marca: THREE.Mesh
    rejilla: THREE.GridHelper | null
    mallas: THREE.Mesh[]
    lineas: THREE.LineSegments[]
    centro: THREE.Vector3
    encuadrado: boolean
  } | null>(null)
  const props = useRef({ seleccion, editable, alSeleccionar, alEmpujar, cajaDe, explotar })
  props.current = { seleccion, editable, alSeleccionar, alEmpujar, cajaDe, explotar }
  const [etiqueta, setEtiqueta] = useState<{ x: number; y: number; texto: string } | null>(null)
  const [listo, setListo] = useState(0)

  // escena, cámara y controles: una sola vez (la cámara no brinca al editar)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f151e)
    const camera = new THREE.PerspectiveCamera(40, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 1, 50000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
    el.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3328, 0.85))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(0.6, 1.4, 1.0)
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffffff, 0.4)
    luz2.position.set(-1, 0.4, -0.8)
    scene.add(luz2)
    const grupo = new THREE.Group()
    const extras = new THREE.Group()
    scene.add(grupo, extras)
    const fantasma = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: SELECCION, transparent: true, opacity: 0.28, depthWrite: false }))
    fantasma.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: SELECCION })))
    fantasma.visible = false
    scene.add(fantasma)
    const marca = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4fd1ff }))
    marca.visible = false
    scene.add(marca)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    st.current = { scene, camera, renderer, controls, grupo, extras, fantasma, marca, rejilla: null, mallas: [], lineas: [], centro: new THREE.Vector3(), encuadrado: false }

    let activo = true
    const animar = () => {
      if (!activo) return
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animar)
    }
    animar()
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 300, h = el.clientHeight || 300
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    // ---- tocar y arrastrar ----
    const ray = new THREE.Raycaster()
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    const golpe = (e: PointerEvent) => {
      const s = st.current!
      ray.setFromCamera(ndc(e), camera)
      return ray.intersectObjects(s.mallas, false)[0] || null
    }
    let inicio: { x: number; y: number } | null = null
    let arrastre: { indice: number; eje: Eje; lado: 0 | 1; delgada: boolean; base: CajaVista; dir: THREE.Vector2; mmPorPx: number; delta: number } | null = null
    const aPantalla = (v: THREE.Vector3) => {
      const p = v.clone().project(camera)
      const r = renderer.domElement.getBoundingClientRect()
      return new THREE.Vector2(((p.x + 1) / 2) * r.width, ((1 - p.y) / 2) * r.height)
    }
    const ponerFantasma = (c: CajaVista) => {
      const a = aThree(c.lo), b = aThree(c.hi)
      fantasma.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
      fantasma.scale.set(Math.max(1, Math.abs(b.x - a.x)), Math.max(1, Math.abs(b.y - a.y)), Math.max(1, Math.abs(b.z - a.z)))
      fantasma.visible = true
    }
    const abajo = (e: PointerEvent) => {
      inicio = { x: e.clientX, y: e.clientY }
      const pr = props.current
      if (!pr.editable || pr.seleccion === null || pr.explotar > 0 || !pr.cajaDe) return
      const g = golpe(e)
      if (!g || (g.object.userData.indice as number) !== pr.seleccion || !g.face) return
      const base = pr.cajaDe(pr.seleccion)
      if (!base) return
      // eje de la cara tocada (normal en coordenadas del mueble)
      const n = g.face.normal.clone()
      const nm: Pt = [n.x, -n.z, n.y]
      const eje = [0, 1, 2].reduce((a, i) => (Math.abs(nm[i]) > Math.abs(nm[a]) ? i : a), 0) as Eje
      const lado = nm[eje] > 0 ? 1 : 0
      const ext = [0, 1, 2].map((i) => base.hi[i] - base.lo[i])
      const delgada = ext[eje] === Math.min(...ext)
      // dirección del eje en pantalla: cuántos mm por pixel
      const p0 = g.point.clone()
      const u: Pt = [0, 0, 0]
      u[eje] = 100
      const p1 = p0.clone().add(aThree(u))
      const s0 = aPantalla(p0), s1 = aPantalla(p1)
      const d = s1.clone().sub(s0)
      if (d.length() < 2) return
      controls.enabled = false
      arrastre = { indice: pr.seleccion, eje, lado: lado as 0 | 1, delgada, base, dir: d.clone().normalize(), mmPorPx: 100 / d.length(), delta: 0 }
      ponerFantasma(base)
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const mueve = (e: PointerEvent) => {
      if (!arrastre || !inicio) return
      const m = new THREE.Vector2(e.clientX - inicio.x, e.clientY - inicio.y)
      const paso = e.shiftKey ? 1 : 5
      const delta = Math.round((m.dot(arrastre.dir) * arrastre.mmPorPx) / paso) * paso
      arrastre.delta = delta
      const c: CajaVista = { lo: [...arrastre.base.lo] as Pt, hi: [...arrastre.base.hi] as Pt }
      if (arrastre.delgada) {
        c.lo[arrastre.eje] += delta
        c.hi[arrastre.eje] += delta
      } else if (arrastre.lado === 1) c.hi[arrastre.eje] = Math.max(c.lo[arrastre.eje] + 20, c.hi[arrastre.eje] + delta)
      else c.lo[arrastre.eje] = Math.min(c.hi[arrastre.eje] - 20, c.lo[arrastre.eje] + delta)
      ponerFantasma(c)
      const r = renderer.domElement.getBoundingClientRect()
      const ejeTxt = ["ancho", "fondo", "alto"][arrastre.eje]
      setEtiqueta({ x: e.clientX - r.left, y: e.clientY - r.top, texto: `${arrastre.delgada ? "Mover" : "Estirar"} ${delta > 0 ? "+" : ""}${delta} mm (${ejeTxt})${arrastre.delgada ? "" : ` · ${Math.round(c.hi[arrastre.eje] - c.lo[arrastre.eje])} mm`}` })
    }
    const arriba = (e: PointerEvent) => {
      const movido = inicio ? Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) : 0
      if (arrastre) {
        const a = arrastre
        arrastre = null
        controls.enabled = true
        fantasma.visible = false
        setEtiqueta(null)
        if (a.delta) props.current.alEmpujar?.(a.indice, a.eje, a.lado, a.delta)
      } else if (movido < 5) {
        const g = golpe(e)
        props.current.alSeleccionar?.(g ? (g.object.userData.indice as number) : null, g ? deThree(g.point.clone().sub(st.current!.grupo.position)) : null)
      }
      inicio = null
    }
    renderer.domElement.addEventListener("pointerdown", abajo)
    renderer.domElement.addEventListener("pointermove", mueve)
    renderer.domElement.addEventListener("pointerup", arriba)

    return () => {
      activo = false
      ro.disconnect()
      renderer.domElement.removeEventListener("pointerdown", abajo)
      renderer.domElement.removeEventListener("pointermove", mueve)
      renderer.domElement.removeEventListener("pointerup", arriba)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
      st.current = null
    }
  }, [])

  // piezas: se rehacen las mallas cuando cambia el diseño
  useEffect(() => {
    let vivo = true
    geometrias(piezas).then((geos) => {
      const s = st.current
      if (!vivo || !s) return
      for (const m of s.mallas) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
      for (const l of s.lineas) {
        l.geometry.dispose()
        ;(l.material as THREE.Material).dispose()
      }
      s.grupo.clear()
      s.mallas = []
      s.lineas = []
      geos.forEach((g, i) => {
        const p = piezas[i]
        const mat = new THREE.MeshStandardMaterial({ color: COLOR[p.plano] ?? 0xd8b98e, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
        const m = new THREE.Mesh(g, mat)
        m.userData.indice = p.indice
        m.userData.plano = p.plano
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: 0x2b1d10 }))
        m.add(l)
        s.grupo.add(m)
        s.mallas.push(m)
        s.lineas.push(l)
      })
      // tableros sueltos: cajas rojas
      s.extras.clear()
      for (const c of sueltos) {
        const a = aThree(c.lo), b = aThree(c.hi)
        const caja = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z)), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.35, depthWrite: false }))
        caja.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
        s.extras.add(caja)
      }
      const caja = new THREE.Box3().setFromObject(s.grupo)
      s.centro = caja.getCenter(new THREE.Vector3())
      if (!s.encuadrado) encuadrar()
      setListo((n) => n + 1)
    })
    return () => {
      vivo = false
    }
  }, [piezas, sueltos]) // eslint-disable-line react-hooks/exhaustive-deps

  const encuadrar = () => {
    const s = st.current
    if (!s || !s.mallas.length) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const r = tam.length() / 2 || 500
    const dist = r / Math.sin(((s.camera.fov * Math.PI) / 180) / 2) * (s.camera.aspect < 1 ? 1.5 : 1.05)
    s.camera.position.copy(centro.clone().add(new THREE.Vector3(0.75, 0.55, 1).normalize().multiplyScalar(dist)))
    s.controls.target.copy(centro)
    s.camera.near = Math.max(1, dist / 200)
    s.camera.far = dist * 20
    s.camera.updateProjectionMatrix()
    if (s.rejilla) s.scene.remove(s.rejilla)
    const rej = new THREE.GridHelper(Math.ceil((Math.max(tam.x, tam.z) * 2.2) / 100) * 100, 22, 0x3b4658, 0x222b38)
    rej.position.set(centro.x, caja.min.y - 0.5, centro.z)
    s.scene.add(rej)
    s.rejilla = rej
    s.encuadrado = true
  }
  useEffect(() => {
    if (ajustar) encuadrar()
  }, [ajustar]) // eslint-disable-line react-hooks/exhaustive-deps

  // selección, rayos X y explosión: sólo materiales y posiciones
  useEffect(() => {
    const s = st.current
    if (!s) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    const tam = caja.getSize(new THREE.Vector3())
    for (const m of s.mallas) {
      const mat = m.material as THREE.MeshStandardMaterial
      const sel = m.userData.indice === seleccion
      mat.color.setHex(sel ? SELECCION : (COLOR[m.userData.plano] ?? 0xd8b98e))
      mat.emissive.setHex(sel ? 0x401800 : 0x000000)
      const transparente = rayosX && !sel
      mat.transparent = transparente
      mat.opacity = transparente ? 0.22 : 1
      mat.depthWrite = !transparente
      mat.needsUpdate = true
      const l = m.children[0] as THREE.LineSegments
      ;(l.material as THREE.LineBasicMaterial).color.setHex(rayosX ? 0xb98a5a : 0x2b1d10)
      // explotar: cada pieza se aleja del centro sobre su grosor
      m.position.set(0, 0, 0)
      if (explotar > 0) {
        const g = m.geometry.boundingBox!
        const c = g.getCenter(new THREE.Vector3())
        const d = c.clone().sub(s.centro)
        const eje = m.userData.plano === "lateral" ? "x" : m.userData.plano === "horizontal" ? "y" : "z"
        const lado = Math.abs(d[eje]) < 1 ? 0 : Math.sign(d[eje])
        const t = tam[eje] || 1
        m.position[eje] = explotar * (d[eje] * 0.7 + lado * t * 0.12)
      }
    }
  }, [seleccion, rayosX, explotar, listo])

  // punto tocado (donde se agrega una repisa o se abre un hueco)
  useEffect(() => {
    const s = st.current
    if (!s) return
    if (punto && explotar === 0) {
      s.marca.position.copy(aThree(punto))
      const caja = new THREE.Box3().setFromObject(s.grupo)
      s.marca.scale.setScalar(Math.max(6, caja.getSize(new THREE.Vector3()).length() / 160))
      s.marca.visible = true
    } else s.marca.visible = false
  }, [punto, explotar, listo])

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full min-h-[260px] w-full cursor-grab overflow-hidden active:cursor-grabbing" />
      {etiqueta && (
        <span className="pointer-events-none absolute rounded-[6px] bg-black/75 px-2 py-1 text-[12px] font-semibold text-white" style={{ left: etiqueta.x + 14, top: etiqueta.y - 10 }}>
          {etiqueta.texto}
        </span>
      )}
    </div>
  )
}
