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
export type PiezaVista = PiezaEnsamble & {
  indice: number
  color?: string // color del material (si no, uno por tipo de pieza)
  veta?: boolean
  // herrajes (opcional): barrenos de cara y de canto, en coordenadas de la pieza
  barrenos?: { u: number; v: number; d: number; prof: number; cara: 0 | 1 }[]
  cantos?: { u: number; v: number; du: number; dv: number; d: number; prof: number }[]
  ranuras?: { u0: number; v0: number; u1: number; v1: number; prof: number; cara: 0 | 1; decor?: boolean }[]
}
// cilindro de radio y alto 1 (se escala por barreno); materiales compartidos
const CILINDRO = new THREE.CylinderGeometry(1, 1, 1, 18)
// rebaje de diseño (shaker, estriado, uñero): sombra suave sobre la cara
const MAT_REBAJE = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
const MAT_BARRENO = new THREE.MeshBasicMaterial({ color: 0x15100a })
const CAJA = new THREE.BoxGeometry(1, 1, 1)
const MAT_CANTO = new THREE.MeshBasicMaterial({ color: 0x2f6fd6 })
const EJE_Y = new THREE.Vector3(0, 1, 0)
// punto del mueble en coordenadas de three
const enThree = (p: PiezaEnsamble, u: number, v: number, w: number) => {
  const q = aMueble(p, u, v, w)
  return new THREE.Vector3(q[0], q[2], -q[1])
}
function herrajes(p: PiezaVista): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  const e = p.grosor
  // dirección del grosor de la pieza en three
  const normal = enThree(p, 0, 0, 1).sub(enThree(p, 0, 0, 0)).normalize()
  for (const b of p.barrenos || []) {
    const c = enThree(p, b.u, b.v, b.cara === 1 ? e - b.prof / 2 + 0.2 : b.prof / 2 - 0.2)
    const m = new THREE.Mesh(CILINDRO, MAT_BARRENO)
    m.position.copy(c)
    m.scale.set(b.d / 2, b.prof + 0.4, b.d / 2)
    m.quaternion.setFromUnitVectors(EJE_Y, normal)
    out.push(m)
  }
  for (const rr of p.ranuras || []) {
    // canal: una caja oscura delgada en la cara de la pieza
    const w0 = rr.cara === 1 ? e - rr.prof : 0, w1 = rr.cara === 1 ? e + 0.2 : rr.prof
    const a = enThree(p, rr.u0, rr.v0, w0), b = enThree(p, rr.u1, rr.v1, w1)
    const m = new THREE.Mesh(CAJA, rr.decor ? MAT_REBAJE : MAT_BARRENO)
    m.position.copy(a.clone().add(b).multiplyScalar(0.5))
    m.scale.set(Math.max(0.5, Math.abs(b.x - a.x)), Math.max(0.5, Math.abs(b.y - a.y)), Math.max(0.5, Math.abs(b.z - a.z)))
    out.push(m)
  }
  for (const k of p.cantos || []) {
    const a = enThree(p, k.u, k.v, e / 2), z = enThree(p, k.u + k.du * k.prof, k.v + k.dv * k.prof, e / 2)
    const dir = z.clone().sub(a)
    const m = new THREE.Mesh(CILINDRO, MAT_CANTO)
    m.position.copy(a.clone().add(z).multiplyScalar(0.5))
    m.scale.set(k.d / 2, dir.length(), k.d / 2)
    m.quaternion.setFromUnitVectors(EJE_Y, dir.normalize())
    out.push(m)
  }
  return out
}
export type CajaVista = { lo: Pt; hi: Pt }
// patas y jaladeras (de catálogo): sólo se dibujan
export type AccesorioVista = { tipo: "pata"; x: number; y: number; z0: number; z1: number; d: number } | { tipo: "jaladera"; a: Pt; b: Pt; sale: Pt }
const MAT_METAL = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.35 })
const MAT_PATA = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.3, roughness: 0.6 })
function cilindroEntre(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const d = b.clone().sub(a)
  const m = new THREE.Mesh(CILINDRO, mat)
  m.position.copy(a.clone().add(b).multiplyScalar(0.5))
  m.scale.set(r, d.length(), r)
  m.quaternion.setFromUnitVectors(EJE_Y, d.normalize())
  return m
}

const COLOR: Record<string, number> = { lateral: 0xd6b48a, horizontal: 0xe8cfa6, frontal: 0xc7a175 }
const SELECCION = 0xff8a3d
const aThree = (p: Pt) => new THREE.Vector3(p[0], p[2], -p[1])
const deThree = (v: THREE.Vector3): Pt => [v.x, -v.z, v.y]

// cocina en habitación: cada tramo se fabrica derecho y aquí se gira a su lugar
export type ColocacionVista = { x0: number; x1: number; origen: number; giro: number; dx: number; dy: number }
export type AmbienteVista = { muros: { lo: Pt; hi: Pt }[]; vidrios: { lo: Pt; hi: Pt }[]; aparatos?: { tipo: string; lo: Pt; hi: Pt }[] }
const matrizTramo = (c: ColocacionVista) =>
  new THREE.Matrix4().makeTranslation(c.dx, 0, -c.dy).multiply(new THREE.Matrix4().makeRotationY(c.giro)).multiply(new THREE.Matrix4().makeTranslation(-c.origen, 0, 0))

// textura de veta de madera (procedural, una sola para todo): líneas onduladas claras y oscuras
let veta: THREE.CanvasTexture | null = null
function texturaVeta() {
  if (veta) return veta
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 256
  const g = c.getContext("2d")!
  g.fillStyle = "#e9e4dc"
  g.fillRect(0, 0, c.width, c.height)
  let semilla = 7
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < 70; k++) {
    const y0 = azar() * c.height
    const amp = 2 + azar() * 6
    const fase = azar() * 6.28
    const oscuro = 150 + Math.floor(azar() * 70)
    g.strokeStyle = `rgba(${oscuro - 40},${oscuro - 60},${oscuro - 80},${0.15 + azar() * 0.3})`
    g.lineWidth = 0.6 + azar() * 2.2
    g.beginPath()
    for (let x = 0; x <= c.width; x += 8) {
      const y = y0 + Math.sin(x / 90 + fase) * amp + Math.sin(x / 23 + fase * 2) * amp * 0.25
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  veta = new THREE.CanvasTexture(c)
  veta.wrapS = veta.wrapT = THREE.RepeatWrapping
  veta.colorSpace = THREE.SRGBColorSpace
  veta.anisotropy = 4
  return veta
}

// letrero de una cota (siempre de frente a la cámara)
function letrero(texto: string, alto: number) {
  const c = document.createElement("canvas")
  const g = c.getContext("2d")!
  const fs = 44
  g.font = `600 ${fs}px system-ui, sans-serif`
  const w = Math.ceil(g.measureText(texto).width) + 28
  c.width = w
  c.height = fs + 22
  g.font = `600 ${fs}px system-ui, sans-serif`
  g.fillStyle = "rgba(11,15,21,0.85)"
  g.beginPath()
  g.roundRect(0, 0, c.width, c.height, 12)
  g.fill()
  g.fillStyle = "#ffffff"
  g.textBaseline = "middle"
  g.fillText(texto, 14, c.height / 2 + 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  sp.scale.set((alto * c.width) / c.height, alto, 1)
  sp.renderOrder = 10
  return sp
}

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
    // coordenadas de textura: proyección por cara, con la veta a lo largo del lado más largo de la pieza
    const bb = g.boundingBox!
    const ext = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]
    const largo = ext.indexOf(Math.max(...ext))
    const nor = g.getAttribute("normal") as THREE.BufferAttribute
    const uv = new Float32Array((pos.length / 3) * 2)
    for (let v = 0; v < pos.length / 3; v++) {
      const n = [Math.abs(nor.getX(v)), Math.abs(nor.getY(v)), Math.abs(nor.getZ(v))]
      const cara = n.indexOf(Math.max(...n))
      const ejes = [0, 1, 2].filter((i) => i !== cara)
      const u = ejes.includes(largo) ? largo : ejes[ext[ejes[0]] >= ext[ejes[1]] ? 0 : 1]
      const w = ejes.find((i) => i !== u)!
      uv[v * 2] = pos[v * 3 + u] / 900
      uv[v * 2 + 1] = pos[v * 3 + w] / 260
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
    return g
  })
}

// vistas estándar, como en SketchUp (en three: y arriba, z al frente, x a la derecha)
export type VistaEstandar = "iso" | "arriba" | "frente" | "derecha" | "atras" | "izquierda" | "abajo"
const DIR_VISTA: Record<VistaEstandar, THREE.Vector3> = {
  iso: new THREE.Vector3(0.75, 0.55, 1),
  arriba: new THREE.Vector3(0, 1, 0.0001),
  frente: new THREE.Vector3(0, 0, 1),
  derecha: new THREE.Vector3(1, 0, 0),
  atras: new THREE.Vector3(0, 0, -1),
  izquierda: new THREE.Vector3(-1, 0, 0),
  abajo: new THREE.Vector3(0, -1, 0.0001),
}

export default function Mueble3D({
  piezas,
  sueltos = [],
  accesorios = [],
  seleccion,
  explotar = 0,
  rayosX = false,
  cotas = true,
  editable = false,
  ajustar = 0,
  vista,
  colocacion,
  ambiente,
  punto,
  alSeleccionar,
  alEmpujar,
  cajaDe,
}: {
  piezas: PiezaVista[]
  sueltos?: CajaVista[] // tableros que no tocan al mueble (se muestran en rojo)
  accesorios?: AccesorioVista[]
  seleccion: number | null // índice de la pieza
  explotar?: number // 0 a 1
  rayosX?: boolean
  cotas?: boolean // líneas de medida del mueble y de la pieza seleccionada
  editable?: boolean
  ajustar?: number // cambiarlo vuelve a encuadrar la cámara
  vista?: { cual: VistaEstandar; n: number } // vista estándar (cambiar n la vuelve a poner)
  colocacion?: ColocacionVista[] // tramos girados a su lugar en la habitación
  ambiente?: AmbienteVista // muros y vidrios de la habitación
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
    luz: THREE.DirectionalLight
    piso: THREE.Mesh
    cotasG: THREE.Group
    sucio: number // cuadros que faltan por dibujar (sólo se dibuja cuando algo cambia)
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
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
    el.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3328, 0.85))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(0.6, 1.4, 1.0)
    luz.castShadow = true
    luz.shadow.mapSize.set(2048, 2048)
    luz.shadow.bias = -0.0004
    scene.add(luz, luz.target)
    // piso que recibe la sombra
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.32 }))
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    scene.add(piso)
    const cotasG = new THREE.Group()
    scene.add(cotasG)
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
    st.current = { scene, camera, renderer, controls, grupo, extras, fantasma, marca, rejilla: null, mallas: [], lineas: [], centro: new THREE.Vector3(), encuadrado: false, luz, piso, cotasG, sucio: 3 }

    let activo = true
    // se dibuja sólo cuando la cámara se mueve o algo cambió: con el mueble quieto
    // no gasta procesador ni batería (una cocina grande pesa en cada cuadro)
    const animar = () => {
      if (!activo) return
      const s = st.current
      const movio = controls.update()
      if (s && (movio || s.sucio > 0)) {
        renderer.render(scene, camera)
        if (s.sucio > 0) s.sucio--
      }
      requestAnimationFrame(animar)
    }
    animar()
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 300, h = el.clientHeight || 300
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (st.current) st.current.sucio = 3
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
      if (st.current) st.current.sucio = 3
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
        if (st.current) st.current.sucio = 3
        setEtiqueta(null)
        if (a.delta) props.current.alEmpujar?.(a.indice, a.eje, a.lado, a.delta)
      } else if (movido < 5) {
        const g = golpe(e)
        const pt = g ? g.point.clone().sub(st.current!.grupo.position) : null
        if (pt && g!.object.userData.inv) pt.applyMatrix4(g!.object.userData.inv as THREE.Matrix4)
        props.current.alSeleccionar?.(g ? (g.object.userData.indice as number) : null, pt ? deThree(pt) : null)
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

  // cualquier cambio que pase por React vuelve a dibujar unos cuadros
  useEffect(() => {
    if (st.current) st.current.sucio = 3
  })

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
      const matrices = (colocacion || []).map((c) => ({ c, M: matrizTramo(c) }))
      const colocar = (x: number) => matrices.find((k) => x >= k.c.x0 && x <= k.c.x1)?.M || null
      geos.forEach((g, i) => {
        const p = piezas[i]
        g.computeBoundingBox()
        const M = matrices.length ? colocar(g.boundingBox!.getCenter(new THREE.Vector3()).x) : null
        if (M) {
          g.applyMatrix4(M)
          g.computeBoundingBox()
        }
        const mat = new THREE.MeshStandardMaterial({ map: p.veta ? texturaVeta() : null, color: p.color ? new THREE.Color(p.color) : (COLOR[p.plano] ?? 0xd8b98e), roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
        const m = new THREE.Mesh(g, mat)
        m.userData.indice = p.indice
        m.userData.plano = p.plano
        m.userData.color = p.color ? new THREE.Color(p.color).getHex() : (COLOR[p.plano] ?? 0xd8b98e)
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: 0x2b1d10 }))
        m.add(l)
        for (const h of herrajes(p)) {
          h.userData.herraje = true
          if (M) h.applyMatrix4(M)
          m.add(h)
        }
        if (M) m.userData.inv = M.clone().invert()
        m.castShadow = true
        m.receiveShadow = true
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
        const M = colocar((c.lo[0] + c.hi[0]) / 2)
        if (M) caja.applyMatrix4(M)
        s.extras.add(caja)
      }
      // patas y jaladeras
      const antes = s.extras.children.length
      for (const ac of accesorios) {
        if (ac.tipo === "pata") s.extras.add(cilindroEntre(aThree([ac.x, ac.y, ac.z0]), aThree([ac.x, ac.y, ac.z1]), ac.d / 2, MAT_PATA))
        else {
          const a = aThree(ac.a), b = aThree(ac.b)
          const sale = aThree(ac.sale).sub(aThree([0, 0, 0]))
          const a2 = a.clone().add(sale), b2 = b.clone().add(sale)
          s.extras.add(cilindroEntre(a, a2, 5, MAT_METAL), cilindroEntre(b, b2, 5, MAT_METAL))
          const largo = b2.clone().sub(a2)
          const ext = largo.clone().normalize().multiplyScalar(25)
          s.extras.add(cilindroEntre(a2.clone().sub(ext), b2.clone().add(ext), 6, MAT_METAL))
        }
      }
      // patas y jaladeras de los tramos girados
      if (matrices.length)
        for (const o of s.extras.children.slice(antes)) {
          const M = colocar(o.position.x)
          if (M) o.applyMatrix4(M)
        }
      const caja = new THREE.Box3().setFromObject(s.grupo)
      s.centro = caja.getCenter(new THREE.Vector3())
      if (!s.encuadrado) encuadrar()
      else ajustarEscena()
      setListo((n) => n + 1)
    })
    return () => {
      vivo = false
    }
  }, [piezas, sueltos, accesorios, colocacion]) // eslint-disable-line react-hooks/exhaustive-deps

  // muros y ventanas de la habitación (sólo se ven; no se tocan)
  useEffect(() => {
    const s = st.current
    if (!s) return
    let amb = s.scene.getObjectByName("ambiente") as THREE.Group | undefined
    if (amb) {
      for (const o of amb.children) {
        ;(o as THREE.Mesh).geometry.dispose()
        ;((o as THREE.Mesh).material as THREE.Material).dispose()
      }
      s.scene.remove(amb)
    }
    if (!ambiente) return
    amb = new THREE.Group()
    amb.name = "ambiente"
    const caja = (c: { lo: Pt; hi: Pt }, mat: THREE.Material) => {
      const a = aThree(c.lo), b = aThree(c.hi)
      const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z)), mat)
      m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
      m.receiveShadow = true
      amb!.add(m)
    }
    for (const c of ambiente.muros) caja(c, new THREE.MeshStandardMaterial({ color: 0xe4e0d8, roughness: 0.95 }))
    for (const c of ambiente.vidrios) caja(c, new THREE.MeshStandardMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }))
    // electrodomésticos: acero, negro y detalles sencillos
    const acero = () => new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.6, roughness: 0.35 })
    const negro = () => new THREE.MeshStandardMaterial({ color: 0x1b1d20, metalness: 0.2, roughness: 0.4 })
    for (const ap of ambiente.aparatos || []) {
      caja(ap, ap.tipo === "parrilla" ? negro() : acero())
      const [x0, y0, z0] = ap.lo, [x1, y1, z1] = ap.hi
      // quemadores: parrilla y estufa
      if (ap.tipo === "parrilla" || ap.tipo === "estufa") {
        const zq = z1 + 1
        const w = x1 - x0, d = y1 - y0
        for (const [fx, fy] of [[0.28, 0.3], [0.72, 0.3], [0.28, 0.7], [0.72, 0.7]]) {
          const r = Math.min(w, d) * 0.11
          const q = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4, 24), ap.tipo === "parrilla" ? acero() : negro())
          const c = aThree([x0 + w * fx, y0 + d * fy, zq])
          q.position.copy(c)
          amb!.add(q)
        }
      }
      // refri: línea de las puertas (congelador arriba)
      if (ap.tipo === "refri") caja({ lo: [x0 + 5, y0 - 2, z0 + (z1 - z0) * 0.68], hi: [x1 - 5, y0, z0 + (z1 - z0) * 0.68 + 8] }, negro())
      // lavavajillas y estufa: tablero de mandos negro arriba al frente
      if (ap.tipo === "lavavajillas" || ap.tipo === "estufa") caja({ lo: [x0 + 5, y0 - 2, z1 - 90], hi: [x1 - 5, y0, z1 - 20] }, negro())
    }
    s.scene.add(amb)
  }, [ambiente])

  // rejilla, piso de sombra y luz según el tamaño del mueble (no mueve la cámara)
  const ajustarEscena = () => {
    const s = st.current
    if (!s || !s.mallas.length) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    if (s.rejilla) s.scene.remove(s.rejilla)
    const rej = new THREE.GridHelper(Math.ceil((Math.max(tam.x, tam.z) * 2.2) / 100) * 100, 22, 0x3b4658, 0x222b38)
    // el piso queda bajo las patas (si hay)
    const conExtras = caja.clone().union(new THREE.Box3().setFromObject(s.extras))
    const pisoY = Math.min(caja.min.y, conExtras.min.y)
    rej.position.set(centro.x, pisoY - 0.5, centro.z)
    s.scene.add(rej)
    s.rejilla = rej
    const lado = Math.max(tam.x, tam.z) * 4
    s.piso.scale.set(lado, lado, 1)
    s.piso.position.set(centro.x, pisoY - 0.2, centro.z)
    // la luz que da sombra sigue al mueble
    const r2 = tam.length()
    s.luz.position.copy(centro.clone().add(new THREE.Vector3(0.45, 1.3, 0.7).normalize().multiplyScalar(r2 * 1.5)))
    s.luz.target.position.copy(centro)
    const cam = s.luz.shadow.camera
    cam.left = cam.bottom = -r2
    cam.right = cam.top = r2
    cam.near = r2 * 0.1
    cam.far = r2 * 4
    cam.updateProjectionMatrix()
  }
  const dirVista = useRef(new THREE.Vector3(0.75, 0.55, 1))
  const encuadrar = () => {
    const s = st.current
    if (!s || !s.mallas.length) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    const tam = caja.getSize(new THREE.Vector3())
    const centro = caja.getCenter(new THREE.Vector3())
    const r = tam.length() / 2 || 500
    const dist = r / Math.sin(((s.camera.fov * Math.PI) / 180) / 2) * (s.camera.aspect < 1 ? 1.5 : 1.05)
    s.camera.position.copy(centro.clone().add(dirVista.current.clone().normalize().multiplyScalar(dist)))
    s.controls.target.copy(centro)
    s.camera.near = Math.max(1, dist / 200)
    s.camera.far = dist * 20
    s.camera.updateProjectionMatrix()
    ajustarEscena()
    s.encuadrado = true
  }
  useEffect(() => {
    if (!vista) return
    dirVista.current.copy(DIR_VISTA[vista.cual])
    encuadrar()
  }, [vista?.cual, vista?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ajustar) return
    dirVista.current.set(0.75, 0.55, 1)
    encuadrar()
    // si el mueble se está rehaciendo, se vuelve a encuadrar cuando termine
    if (st.current) st.current.encuadrado = false
  }, [ajustar]) // eslint-disable-line react-hooks/exhaustive-deps

  // cotas: ancho, alto y fondo del mueble, y las medidas de la pieza seleccionada
  useEffect(() => {
    const s = st.current
    if (!s) return
    for (const o of [...s.cotasG.children]) {
      s.cotasG.remove(o)
      o.traverse((x) => {
        const mm = x as THREE.Mesh
        mm.geometry?.dispose?.()
        const mat = mm.material as THREE.Material & { map?: THREE.Texture }
        mat?.map?.dispose?.()
        mat?.dispose?.()
      })
    }
    if (!cotas || explotar > 0 || !s.mallas.length) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    if (s.extras.children.length) caja.union(new THREE.Box3().setFromObject(s.extras))
    const tam = caja.getSize(new THREE.Vector3())
    const off = Math.max(60, tam.length() * 0.06)
    const alto = Math.max(30, tam.length() * 0.035)
    const matL = new THREE.LineBasicMaterial({ color: 0x7fd3ff, depthTest: false, transparent: true })
    const cota = (a: THREE.Vector3, b: THREE.Vector3, hacia: THREE.Vector3, texto: string, mat = matL) => {
      const t = hacia.clone().normalize().multiplyScalar(off * 0.35)
      const pts = [a, b, a.clone().sub(t), a.clone().add(t), b.clone().sub(t), b.clone().add(t)]
      const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]])
      const l = new THREE.LineSegments(geo, mat)
      l.renderOrder = 9
      s.cotasG.add(l)
      const sp = letrero(texto, alto)
      sp.position.copy(a.clone().add(b).multiplyScalar(0.5).add(hacia.clone().normalize().multiplyScalar(off * 0.6)))
      s.cotasG.add(sp)
    }
    const { min, max } = caja
    const mm = (v: number) => `${Math.round(v)} mm`
    // ancho: al frente, abajo; alto: a la izquierda, al frente; fondo: a la derecha, abajo
    cota(new THREE.Vector3(min.x, min.y, max.z + off), new THREE.Vector3(max.x, min.y, max.z + off), new THREE.Vector3(0, 0, 1), mm(tam.x))
    cota(new THREE.Vector3(min.x - off, min.y, max.z), new THREE.Vector3(min.x - off, max.y, max.z), new THREE.Vector3(-1, 0, 0), mm(tam.y))
    cota(new THREE.Vector3(max.x + off, min.y, min.z), new THREE.Vector3(max.x + off, min.y, max.z), new THREE.Vector3(1, 0, 0), mm(tam.z))
    // pieza seleccionada: sus dos medidas grandes, pegadas a ella
    const sel = s.mallas.find((m) => m.userData.indice === seleccion)
    if (sel) {
      const b = new THREE.Box3().setFromObject(sel)
      const e = b.getSize(new THREE.Vector3())
      const matS = new THREE.LineBasicMaterial({ color: 0xffb070, depthTest: false, transparent: true })
      const ejes = (["x", "y", "z"] as const).filter((k) => e[k] > Math.min(e.x, e.y, e.z) + 0.5)
      for (const k of ejes.slice(0, 2)) {
        const a = b.min.clone(), z = b.min.clone()
        z[k] = b.max[k]
        // sobre la cara del frente (z mayor) para que se vea
        a.z = z.z = Math.max(b.max.z, k === "z" ? b.min.z : b.max.z)
        if (k === "z") {
          a.z = b.min.z
          z.z = b.max.z
          a.x = z.x = b.max.x
        }
        const hacia = k === "x" ? new THREE.Vector3(0, -1, 0) : k === "y" ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0)
        const t = hacia.clone().multiplyScalar(off * 0.5)
        cota(a.clone().add(t), z.clone().add(t), hacia, mm(e[k]), matS)
      }
    }
  }, [cotas, explotar, seleccion, listo])

  // selección, rayos X y explosión: sólo materiales y posiciones
  useEffect(() => {
    const s = st.current
    if (!s) return
    const caja = new THREE.Box3().setFromObject(s.grupo)
    const tam = caja.getSize(new THREE.Vector3())
    // las patas y jaladeras no se separan: se esconden al explotar
    s.extras.visible = explotar === 0
    for (const m of s.mallas) {
      const mat = m.material as THREE.MeshStandardMaterial
      const sel = m.userData.indice === seleccion
      mat.color.setHex(sel ? SELECCION : m.userData.color)
      mat.emissive.setHex(sel ? 0x401800 : 0x000000)
      const transparente = rayosX && !sel
      mat.transparent = transparente
      mat.opacity = transparente ? 0.22 : 1
      mat.depthWrite = !transparente
      mat.needsUpdate = true
      // en rayos X los herrajes se ven a través del mueble
      for (const h of m.children) if (h.userData.herraje) ((h as THREE.Mesh).renderOrder = rayosX ? 2 : 0)
      const l = m.children[0] as THREE.LineSegments
      ;(l.material as THREE.LineBasicMaterial).color.setHex(rayosX ? 0xb98a5a : 0x2b1d10)
      // explotar: cada pieza se aleja del centro sobre su grosor
      m.position.set(0, 0, 0)
      if (explotar > 0) {
        const g = m.geometry.boundingBox!
        const c = g.getCenter(new THREE.Vector3())
        const d = c.clone().sub(s.centro)
        const tg = g.getSize(new THREE.Vector3())
        const eje = tg.x <= tg.y && tg.x <= tg.z ? "x" : tg.y <= tg.z ? "y" : "z"
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
      const c = (colocacion || []).find((k) => punto[0] >= k.x0 && punto[0] <= k.x1)
      if (c) s.marca.position.applyMatrix4(matrizTramo(c))
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
