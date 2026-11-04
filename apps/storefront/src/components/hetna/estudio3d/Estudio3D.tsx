"use client"

// Estudio 3D de HETNA: la pantalla común para ver y exportar piezas en 3D
// (escaneos, y después las demás herramientas que producen STL).
//
//   ┌ panel de ajustes ┐┌ pestañas: Vista 3D · Exportación ── mm / in ┐
//   │ material, modo,  ││                 visor three.js                │
//   │ vistas, medidas  ││ barra: girar · centrar · imagen · pantalla    │
//   └──────────────────┘└ barra de datos: medidas · triángulos · cierra ┘
//
// Carga un STL desde `urlStl` (una ruta del propio sitio: no se exponen
// enlaces firmados de almacenamiento) o una malla ya armada en `tris`.
import { useCallback, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

type Unidad = "mm" | "in"
type Modo = "color" | "blanco" | "gris" | "normales" | "malla"
type Vista = "iso" | "frente" | "lado" | "arriba"

export type Descarga = { etiqueta: string; href: string; nota?: string }

const MATERIALES: { id: string; nombre: string; color: number; rugosidad: number; metal: number; fibra?: boolean; muestra?: string }[] = [
  { id: "naranja", nombre: "HETNA", color: 0xff6a1a, rugosidad: 0.5, metal: 0.05 },
  { id: "mdf", nombre: "MDF", color: 0xffffff, rugosidad: 0.9, metal: 0, fibra: true, muestra: "#b88758" },
  { id: "metal", nombre: "Metal", color: 0xc4c9d0, rugosidad: 0.32, metal: 0.85 },
  { id: "blanco", nombre: "Resina", color: 0xeeeae2, rugosidad: 0.4, metal: 0 },
]

// Textura de MDF hecha en el navegador: color café claro con fibra fina.
let texturaMDF: THREE.CanvasTexture | null = null
function mdf() {
  if (texturaMDF) return texturaMDF
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  g.fillStyle = "#a9794d"
  g.fillRect(0, 0, 512, 512)
  const img = g.getImageData(0, 0, 512, 512)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26
    img.data[i] += n
    img.data[i + 1] += n * 0.85
    img.data[i + 2] += n * 0.6
  }
  g.putImageData(img, 0, 0)
  g.globalAlpha = 0.08
  for (let k = 0; k < 900; k++) {
    g.strokeStyle = Math.random() > 0.5 ? "#8a6440" : "#e8c9a2"
    g.lineWidth = Math.random() * 1.2 + 0.3
    const x = Math.random() * 512
    const y = Math.random() * 512
    const a = Math.random() * Math.PI
    const l = Math.random() * 14 + 4
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  texturaMDF = new THREE.CanvasTexture(c)
  texturaMDF.wrapS = texturaMDF.wrapT = THREE.RepeatWrapping
  texturaMDF.colorSpace = THREE.SRGBColorSpace
  return texturaMDF
}

// Coordenadas de textura por caras (proyección según hacia dónde mira cada
// triángulo): las mallas que vienen de STL o de extrusiones no las traen.
function ponerUV(geo: THREE.BufferGeometry, escala: number) {
  const pos = geo.getAttribute("position")
  const uv = new Float32Array(pos.count * 2)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    n.subVectors(b, a).cross(c.clone().sub(a))
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
    ;[a, b, c].forEach((v, k) => {
      const [u, w] = ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y]
      uv[(i + k) * 2] = u / escala
      uv[(i + k) * 2 + 1] = w / escala
    })
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
}

const fmt = (mm: number, u: Unidad) => (u === "mm" ? `${mm.toFixed(1)} mm` : `${(mm / 25.4).toFixed(2)} in`)

const BotonBarra = ({ activo, onClick, titulo, children }: { activo: boolean; onClick: () => void; titulo: string; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    title={titulo}
    aria-label={titulo}
    aria-pressed={activo}
    className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${activo ? "bg-[#2B3648] text-[#F28A3C]" : "text-[#C9D2E0] hover:bg-[#1C2431]"}`}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  </button>
)

export function Estudio3D({
  titulo,
  subtitulo,
  urlStl,
  urlGlb,
  tris,
  escalaReal = true,
  descargas = [],
  avisos = [],
  materialInicial = "naranja",
  lineas = false,
  dePie = false,
  segunda,
  panel,
  diseno2d,
  exportacion,
  barra,
  llenar = false,
}: {
  titulo: string
  subtitulo?: string
  urlStl?: string
  // modelo con textura (GLB) en lugar de STL; tiene prioridad sobre urlStl
  urlGlb?: string
  tris?: number[]
  // false: la malla no está en milímetros reales (vista previa por IA)
  escalaReal?: boolean
  descargas?: Descarga[]
  avisos?: string[]
  materialInicial?: string
  // marcar las orillas de cada pieza (piezas cortadas, no escaneos)
  lineas?: boolean
  // letras y letreros: la pieza parada mirando al frente (Y arriba); sin
  // esto se acuesta como un STL normal (Z arriba)
  dePie?: boolean
  // otra malla encima, translúcida (p. ej. el frente de acrílico)
  segunda?: { tris: number[]; color: number; opacidad: number }
  // controles propios de la herramienta, arriba del panel
  panel?: React.ReactNode
  // pestaña "Diseño 2D" (la hoja de corte); sin esto no aparece
  diseno2d?: React.ReactNode
  // reemplaza la pestaña Exportación de siempre
  exportacion?: React.ReactNode
  // texto extra en la barra de datos
  barra?: React.ReactNode
  // ocupar toda la pantalla de los estudios (debajo de su barra de 3.5rem)
  llenar?: boolean
}) {
  const contRef = useRef<HTMLDivElement>(null)
  const marcoRef = useRef<HTMLDivElement>(null)
  const estado = useRef<{
    renderer?: THREE.WebGLRenderer
    camara?: THREE.PerspectiveCamera
    controles?: OrbitControls
    material?: THREE.MeshStandardMaterial
    alambre?: THREE.LineSegments
    malla?: THREE.Mesh
    piezas?: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[]
    luces?: { luz: THREE.DirectionalLight; hemi: THREE.HemisphereLight }
    rejilla?: THREE.GridHelper
    cajaAyuda?: THREE.Box3Helper
    distancia?: number
  }>({})

  const dePieRef = useRef(dePie)
  dePieRef.current = dePie
  const [pestana, setPestana] = useState<"diseno" | "vista" | "exportar">(diseno2d ? "diseno" : "vista")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [material, setMaterial] = useState(materialInicial)
  const [modo, setModo] = useState<Modo>("color")
  const [luzFuerte, setLuzFuerte] = useState(true)
  const [menuDescarga, setMenuDescarga] = useState(false)
  const gizmoRef = useRef<SVGSVGElement>(null)
  const [conTextura, setConTextura] = useState(false)
  const [rejilla, setRejilla] = useState(true)
  const [medidas, setMedidas] = useState(!dePie)
  const [girar, setGirar] = useState(false)
  const [completa, setCompleta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<{ x: number; y: number; z: number; triangulos: number; vertices: number } | null>(null)

  // ---- Escena: se arma una vez por pieza --------------------------------
  useEffect(() => {
    const el = contRef.current
    if (!el) return
    let vivo = true

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x10151d)
    const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 50000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.95
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    // Luz de estudio: reflejos suaves en todas las caras
    const pmrem = new THREE.PMREMGenerator(renderer)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = entorno
    el.appendChild(renderer.domElement)
    const controles = new OrbitControls(camara, renderer.domElement)
    controles.enableDamping = true

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223044, 0.35)
    scene.add(hemi)
    const luz = new THREE.DirectionalLight(0xffffff, 1.6)
    luz.position.set(1, 2, 1.5)
    luz.castShadow = true
    luz.shadow.mapSize.set(2048, 2048)
    luz.shadow.bias = -0.0004
    luz.shadow.radius = 4
    scene.add(luz)
    const luz2 = new THREE.DirectionalLight(0xffd9bd, 0.35)
    luz2.position.set(-1.5, 0.6, -1)
    scene.add(luz2)

    const ajustar = () => {
      const w = el.clientWidth || 300
      const h = el.clientHeight || 300
      renderer.setSize(w, h)
      camara.aspect = w / h
      camara.updateProjectionMatrix()
    }
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)
    ajustar()

    // Encuadre común: piso con sombra, luz, rejilla, caja de medidas y cámara
    const encuadrar = (tam: THREE.Vector3, cajaPieza: THREE.Box3, extra: Partial<typeof estado.current>) => {
      const lado0 = Math.max(tam.x, tam.y, tam.z) || 1
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(lado0 * 6, lado0 * 6), new THREE.ShadowMaterial({ opacity: 0.35 }))
      piso.rotation.x = -Math.PI / 2
      piso.position.y = -0.01
      piso.receiveShadow = true
      scene.add(piso)
      luz.position.set(lado0 * 0.8, lado0 * 1.8, lado0 * 1.2)
      luz.target.position.set(0, tam.y / 2, 0)
      scene.add(luz.target)
      const sc = luz.shadow.camera
      sc.left = sc.bottom = -lado0
      sc.right = sc.top = lado0
      sc.near = lado0 * 0.1
      sc.far = lado0 * 5
      sc.updateProjectionMatrix()

      const grid = new THREE.GridHelper(Math.ceil(lado0 * 3), 30, 0x2e3a4e, 0x1a2230)
      scene.add(grid)
      const cajaAyuda = new THREE.Box3Helper(cajaPieza.clone(), new THREE.Color(0xf2a65a))
      scene.add(cajaAyuda)

      const radio = tam.length() / 2
      const vfov = (camara.fov * Math.PI) / 180
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camara.aspect)
      const distancia = Math.max(radio / Math.sin(vfov / 2), radio / Math.sin(hfov / 2)) * 0.82
      camara.near = lado0 / 1000
      camara.far = lado0 * 100
      camara.updateProjectionMatrix()
      controles.target.set(0, tam.y / 2, 0)

      Object.assign(estado.current, { renderer, camara, controles, rejilla: grid, cajaAyuda, distancia, luces: { luz, hemi }, ...extra })
      ponerVista("iso")
      setCargando(false)
    }

    const montar = (geo: THREE.BufferGeometry) => {
      if (!vivo) return
      geo.computeVertexNormals()
      // Los STL vienen con Z arriba; three mira con Y arriba. Un letrero va
      // parado: su Y ya es "arriba" y su Z sale hacia quien lo ve.
      if (!dePie) geo.rotateX(-Math.PI / 2)
      geo.computeBoundingBox()
      const caja = geo.boundingBox!
      const centro = caja.getCenter(new THREE.Vector3())
      geo.translate(-centro.x, -caja.min.y, -centro.z)
      geo.computeBoundingBox()
      const tam = geo.boundingBox!.getSize(new THREE.Vector3())

      const lado0 = Math.max(tam.x, tam.y, tam.z) || 1
      ponerUV(geo, Math.max(60, lado0 / 3))
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.9 })
      const malla = new THREE.Mesh(geo, mat)
      malla.castShadow = true
      malla.receiveShadow = true
      scene.add(malla)
      // Orillas marcadas: cada corte se ve como en la pieza real
      if (lineas && (geo.getAttribute("position")?.count || 0) < 900000) {
        const orillas = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 28),
          new THREE.LineBasicMaterial({ color: 0x3b2716, transparent: true, opacity: 0.55 })
        )
        scene.add(orillas)
      }

      if (segunda && segunda.tris.length >= 9) {
        const g2 = new THREE.BufferGeometry()
        g2.setAttribute("position", new THREE.Float32BufferAttribute(segunda.tris, 3))
        g2.computeVertexNormals()
        if (!dePie) g2.rotateX(-Math.PI / 2)
        g2.translate(-centro.x, -caja.min.y, -centro.z)
        // Acrílico pulido. Sin "transmission": obliga a dibujar la escena dos
        // veces por cuadro y en un celular barato se nota.
        const m2 = new THREE.MeshPhysicalMaterial({
          color: segunda.color,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          roughness: 0.08,
          metalness: 0,
          transparent: true,
          opacity: Math.max(0.3, segunda.opacidad),
          depthWrite: false,
          side: THREE.DoubleSide,
          envMapIntensity: 1.2,
        })
        const acr = new THREE.Mesh(g2, m2)
        acr.castShadow = true
        scene.add(acr)
        scene.add(
          new THREE.LineSegments(new THREE.EdgesGeometry(g2, 28), new THREE.LineBasicMaterial({ color: 0xdbe8ff, transparent: true, opacity: 0.85 }))
        )
      }

      const n = geo.getAttribute("position")?.count || 0
      setDatos({ x: tam.x, y: dePie ? tam.y : tam.z, z: dePie ? tam.z : tam.y, triangulos: n / 3, vertices: n })
      setConTextura(false)
      encuadrar(tam, geo.boundingBox!, { material: mat, malla, piezas: [{ mesh: malla, original: mat }] })
    }

    // Modelo GLB con sus materiales y texturas (Y ya es arriba)
    const montarGlb = (obj: THREE.Object3D) => {
      if (!vivo) return
      const caja = new THREE.Box3().setFromObject(obj)
      const centro = caja.getCenter(new THREE.Vector3())
      obj.position.sub(new THREE.Vector3(centro.x, caja.min.y, centro.z))
      scene.add(obj)
      const cajaFinal = new THREE.Box3().setFromObject(obj)
      const tam = cajaFinal.getSize(new THREE.Vector3())
      const piezas: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = []
      let tri = 0, ver = 0
      obj.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.castShadow = true
        m.receiveShadow = true
        piezas.push({ mesh: m, original: m.material })
        const c = m.geometry.getAttribute("position")?.count || 0
        ver += c
        tri += m.geometry.index ? m.geometry.index.count / 3 : c / 3
      })
      setDatos({ x: tam.x, y: tam.z, z: tam.y, triangulos: tri, vertices: ver })
      setConTextura(true)
      encuadrar(tam, cajaFinal, { piezas })
    }

    if (tris && tris.length >= 9) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3))
      montar(geo)
    } else if (urlGlb) {
      new GLTFLoader().load(
        urlGlb,
        (g) => montarGlb(g.scene),
        undefined,
        () => {
          if (vivo) {
            setError("No se pudo cargar el modelo")
            setCargando(false)
          }
        }
      )
    } else if (urlStl) {
      fetch(urlStl, { credentials: "include" })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.mensaje || "No se pudo cargar la pieza")
          return r.arrayBuffer()
        })
        .then((buf) => montar(new STLLoader().parse(buf)))
        .catch((e: Error) => {
          if (vivo) {
            setError(e.message)
            setCargando(false)
          }
        })
    }

    let cuadro = 0
    const ejes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
    const inv = new THREE.Quaternion()
    const v = new THREE.Vector3()
    const animar = () => {
      cuadro = requestAnimationFrame(animar)
      controles.update()
      renderer.render(scene, camara)
      // Ejes de orientación: dónde quedan X, Y y Z vistos desde la cámara
      const svg = gizmoRef.current
      if (svg) {
        inv.copy(camara.quaternion).invert()
        ejes.forEach((e, k) => {
          v.copy(e).applyQuaternion(inv)
          const x = 32 + v.x * 22
          const y = 32 - v.y * 22
          const linea = svg.querySelector<SVGLineElement>(`[data-eje="${k}"]`)
          const punta = svg.querySelector<SVGCircleElement>(`[data-punta="${k}"]`)
          linea?.setAttribute("x2", x.toFixed(1))
          linea?.setAttribute("y2", y.toFixed(1))
          punta?.setAttribute("cx", x.toFixed(1))
          punta?.setAttribute("cy", y.toFixed(1))
        })
      }
    }
    animar()

    return () => {
      vivo = false
      cancelAnimationFrame(cuadro)
      obs.disconnect()
      controles.dispose()
      entorno.dispose()
      pmrem.dispose()
      renderer.dispose()
      scene.traverse((o) => {
        const x = o as THREE.Mesh
        x.geometry?.dispose?.()
        const mats = Array.isArray(x.material) ? x.material : x.material ? [x.material] : []
        mats.forEach((mm) => mm.dispose())
      })
      el.removeChild(renderer.domElement)
      estado.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStl, urlGlb, tris, segunda, lineas, dePie])

  // ---- Ajustes que no rearman la escena --------------------------------
  useEffect(() => {
    const m = MATERIALES.find((x) => x.id === material) || MATERIALES[0]
    const mat = estado.current.material
    if (!mat) return
    mat.color.setHex(m.color)
    mat.roughness = m.rugosidad
    mat.metalness = m.metal
    mat.map = m.fibra ? mdf() : null
    mat.needsUpdate = true
  }, [material, cargando])

  // Modos de vista: color (material o textura del modelo), blanco, gris
  // (arcilla), normales (revisar la superficie) y malla (ver los triángulos)
  const vistas = useRef<Record<string, THREE.Material>>({})
  useEffect(() => {
    const piezas = estado.current.piezas
    if (!piezas) return
    const cache = vistas.current
    cache.blanco ||= new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.55, side: THREE.DoubleSide })
    cache.gris ||= new THREE.MeshStandardMaterial({ color: 0x8b919b, roughness: 0.75, side: THREE.DoubleSide })
    cache.normales ||= new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })
    cache.malla ||= new THREE.MeshBasicMaterial({ color: 0x9fb3d1, wireframe: true })
    for (const p of piezas) p.mesh.material = modo === "color" ? p.original : cache[modo]
  }, [modo, cargando])

  useEffect(() => {
    const l = estado.current.luces
    if (!l) return
    l.luz.intensity = luzFuerte ? 1.6 : 0.7
    l.hemi.intensity = luzFuerte ? 0.35 : 0.9
  }, [luzFuerte, cargando])

  useEffect(() => {
    const { rejilla: g, cajaAyuda } = estado.current
    if (g) g.visible = rejilla
    if (cajaAyuda) cajaAyuda.visible = medidas
  }, [rejilla, medidas, cargando])

  useEffect(() => {
    const c = estado.current.controles
    if (!c) return
    c.autoRotate = girar
    c.autoRotateSpeed = 1.6
  }, [girar, cargando])

  useEffect(() => {
    const onCambio = () => setCompleta(document.fullscreenElement === marcoRef.current)
    document.addEventListener("fullscreenchange", onCambio)
    return () => document.removeEventListener("fullscreenchange", onCambio)
  }, [])

  const ponerVista = useCallback((v: Vista) => {
    const { camara, controles, distancia } = estado.current
    if (!camara || !controles || !distancia) return
    const dir =
      v === "frente" ? new THREE.Vector3(0, 0, 1) : v === "lado" ? new THREE.Vector3(1, 0, 0) : v === "arriba" ? new THREE.Vector3(0, 1, 0.0001) : dePieRef.current ? new THREE.Vector3(0.55, 0.35, 1) : new THREE.Vector3(1, 0.8, 1.1)
    camara.position.copy(controles.target).add(dir.normalize().multiplyScalar(distancia))
    camara.lookAt(controles.target)
    controles.update()
  }, [])

  const guardarImagen = () => {
    const r = estado.current.renderer
    if (!r) return
    const a = document.createElement("a")
    a.href = r.domElement.toDataURL("image/png")
    a.download = `${titulo.replace(/[^\w\-áéíóúñ ]+/gi, "").trim() || "pieza"}.png`
    a.click()
  }

  const pantallaCompleta = () => {
    const el = marcoRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  const Chip = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex-1 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold transition ${
        activo ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
      }`}
    >
      {children}
    </button>
  )

  const Interruptor = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-pressed={activo} className="flex items-center justify-between w-full py-1.5 text-[13.5px] text-[#C9D2E0]">
      {children}
      <span className={`w-9 h-5 rounded-full relative transition ${activo ? "bg-[#C2560A]" : "bg-[#2B3648]"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${activo ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  )

  return (
    <div ref={marcoRef} className={`bg-[#0B1017] text-white overflow-hidden grid lg:grid-cols-[280px_1fr] ${completa ? "h-screen rounded-none" : llenar ? "flex-1 min-h-[calc(100dvh-3.5rem)] rounded-none" : "rounded-[16px]"}`}>
      {/* ---- Panel de ajustes ---- */}
      <aside className={`bg-[#121923] border-b lg:border-b-0 lg:border-r border-[#1F2937] p-4 flex flex-col gap-5 lg:overflow-y-auto [&>*]:shrink-0 ${llenar ? "lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)]" : "lg:max-h-[720px]"}`}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[10px] bg-[#C2560A]/15 text-[#F28A3C] flex items-center justify-center" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M12 2l9 5v10l-9 5-9-5V7z" />
              <path d="M12 22V12M21 7l-9 5-9-5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="m-0 font-display text-[16px] font-bold leading-tight">
              Estudio <span className="text-[#F28A3C]">3D</span>
            </p>
            <p className="m-0 text-[12px] text-[#8A97AB] truncate">{subtitulo || titulo}</p>
          </div>
        </div>

        {panel}

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Material</h3>
          <div className="grid grid-cols-2 gap-2">
            {MATERIALES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMaterial(m.id)}
                aria-pressed={material === m.id}
                className={`flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold ${
                  material === m.id ? "bg-[#243045] ring-1 ring-[#C2560A]" : "bg-[#1C2431] hover:bg-[#243045]"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: m.muestra || `#${m.color.toString(16).padStart(6, "0")}` }} />
                {m.nombre}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Vista</h3>
          <div className="grid grid-cols-2 gap-1.5">
            <Chip activo={false} onClick={() => ponerVista("iso")}>Isométrica</Chip>
            <Chip activo={false} onClick={() => ponerVista("frente")}>Frente</Chip>
            <Chip activo={false} onClick={() => ponerVista("lado")}>Lado</Chip>
            <Chip activo={false} onClick={() => ponerVista("arriba")}>Arriba</Chip>
          </div>
        </section>

        <section className="flex flex-col">
          <Interruptor activo={rejilla} onClick={() => setRejilla((v) => !v)}>Rejilla</Interruptor>
          <Interruptor activo={medidas} onClick={() => setMedidas((v) => !v)}>Caja de medidas</Interruptor>
          <Interruptor activo={girar} onClick={() => setGirar((v) => !v)}>Girar sola</Interruptor>
        </section>

        {avisos.length > 0 && (
          <section className="flex flex-col gap-2">
            {avisos.map((a) => (
              <p key={a} className="m-0 rounded-[10px] border border-[#5A4A2A] bg-[#2A2215] px-3 py-2 text-[12.5px] leading-snug text-[#F2D29B]">
                {a}
              </p>
            ))}
          </section>
        )}
      </aside>

      {/* ---- Zona principal ---- */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[#1F2937] bg-[#0F151E]">
          <div className="flex gap-1">
            {(
              [
                ...(diseno2d ? ([["diseno", "Diseño 2D"]] as const) : []),
                ["vista", "Vista 3D"],
                ["exportar", "Exportación"],
              ] as const
            ).map(([id, txt]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPestana(id)}
                aria-pressed={pestana === id}
                className={`rounded-[8px] px-3.5 py-2 text-[13.5px] font-semibold ${
                  pestana === id ? "bg-[#C2560A]/20 text-[#F28A3C] ring-1 ring-[#C2560A]/50" : "text-[#C9D2E0] hover:bg-[#1C2431]"
                }`}
              >
                {txt}
              </button>
            ))}
          </div>
          <div className="flex rounded-[8px] bg-[#1C2431] p-0.5">
            {(["mm", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnidad(u)}
                aria-pressed={unidad === u}
                className={`rounded-[6px] px-3 py-1 text-[13px] font-semibold ${unidad === u ? "bg-[#2B3648] text-white" : "text-[#8A97AB]"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className={`relative ${pestana === "vista" ? "" : "hidden"} ${completa || llenar ? "flex-1" : "h-[420px] lg:h-[560px]"}`}>
          <div ref={contRef} className="absolute inset-0" />
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[#8A97AB]">Cargando la pieza…</div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] text-[#F2B8A8]">{error}</div>
          )}
          {datos && (
            <dl className="pointer-events-none absolute top-3 left-3 m-0 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[12px]">
              <dt className="text-[#8A97AB]">Caras</dt>
              <dd className="m-0 font-semibold text-white">{Math.round(datos.triangulos).toLocaleString("es-MX")}</dd>
              <dt className="text-[#8A97AB]">Vértices</dt>
              <dd className="m-0 font-semibold text-white">{Math.round(datos.vertices).toLocaleString("es-MX")}</dd>
              {conTextura && (
                <>
                  <dt className="text-[#8A97AB]">Material</dt>
                  <dd className="m-0 font-semibold text-white">Textura PBR</dd>
                </>
              )}
            </dl>
          )}

          <svg ref={gizmoRef} viewBox="0 0 64 64" className="pointer-events-none absolute top-3 right-3 w-16 h-16 rounded-full bg-[#1C2431]/80" aria-hidden="true">
            {[
              ["#ef4444", "X"],
              ["#22c55e", "Y"],
              ["#3b82f6", "Z"],
            ].map(([c], k) => (
              <g key={k}>
                <line data-eje={k} x1="32" y1="32" x2="32" y2="32" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
                <circle data-punta={k} cx="32" cy="32" r="4.5" fill={c} />
              </g>
            ))}
          </svg>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-[14px] bg-[#0B1017]/90 border border-[#1F2937] px-2 py-1.5 shadow-lg max-w-[calc(100%-24px)] overflow-x-auto">
            <BotonBarra activo={girar} onClick={() => setGirar((x) => !x)} titulo="Girar sola">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </BotonBarra>
            <span className="w-px h-5 bg-[#2B3648] mx-1" />
            {(
              [
                ["color", conTextura ? "Textura" : "Color", "#F28A3C"],
                ["blanco", "Blanco", "#F4F2EE"],
                ["gris", "Gris", "#8B919B"],
                ["normales", "Normales", "url(#arcoiris)"],
                ["malla", "Malla", "none"],
              ] as const
            ).map(([id, txt, color]) => (
              <button
                key={id}
                type="button"
                title={txt}
                aria-label={txt}
                aria-pressed={modo === id}
                onClick={() => setModo(id)}
                className={`w-8 h-8 rounded-[8px] flex items-center justify-center ${modo === id ? "bg-[#2B3648]" : "hover:bg-[#1C2431]"}`}
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={
                    id === "normales"
                      ? { background: "conic-gradient(#f43f5e,#eab308,#22c55e,#3b82f6,#a855f7,#f43f5e)" }
                      : id === "malla"
                        ? { border: "1.5px dashed #9FB3D1" }
                        : { background: color, boxShadow: "inset -2px -2px 3px rgba(0,0,0,.35)" }
                  }
                />
              </button>
            ))}
            <span className="w-px h-5 bg-[#2B3648] mx-1" />
            <BotonBarra activo={false} onClick={() => ponerVista("iso")} titulo="Centrar">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              <circle cx="12" cy="12" r="2.5" />
            </BotonBarra>
            <BotonBarra activo={luzFuerte} onClick={() => setLuzFuerte((x) => !x)} titulo="Luz de estudio">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </BotonBarra>
            <BotonBarra activo={completa} onClick={pantallaCompleta} titulo="Pantalla completa">
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </BotonBarra>
            <span className="w-px h-5 bg-[#2B3648] mx-1" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuDescarga((x) => !x)}
                aria-expanded={menuDescarga}
                className="flex items-center gap-1 rounded-[8px] bg-[#C2560A] hover:bg-[#A84A08] px-3 py-1.5 text-[13px] font-semibold"
              >
                Descargar <span aria-hidden="true">{menuDescarga ? "▴" : "▾"}</span>
              </button>
              {menuDescarga && (
                <div className="absolute bottom-full right-0 mb-2 min-w-[150px] rounded-[10px] bg-[#0B1017] border border-[#2B3648] py-1 shadow-xl">
                  {descargas.map((d) => (
                    <a key={d.href} href={d.href} onClick={() => setMenuDescarga(false)} className="block px-3.5 py-2 text-[13px] text-white hover:bg-[#1C2431]">
                      {d.etiqueta.replace(/^Descargar\s*/i, "")}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      guardarImagen()
                      setMenuDescarga(false)
                    }}
                    className="block w-full text-left px-3.5 py-2 text-[13px] text-white hover:bg-[#1C2431]"
                  >
                    Imagen (PNG)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {pestana === "diseno" && diseno2d && (
          <div className={`overflow-auto bg-[#0B1017] ${completa || llenar ? "flex-1" : "h-[420px] lg:h-[560px]"}`}>{diseno2d}</div>
        )}

        {pestana === "exportar" && exportacion && (
          <div className={`p-5 lg:p-8 ${completa || llenar ? "flex-1" : "min-h-[420px] lg:min-h-[560px]"}`}>{exportacion}</div>
        )}

        {pestana === "exportar" && !exportacion && (
          <div className={`p-5 lg:p-8 flex flex-col gap-4 ${completa || llenar ? "flex-1" : "min-h-[420px] lg:min-h-[560px]"}`}>
            <h3 className="m-0 text-[18px] font-bold">Descargar la pieza</h3>
            {descargas.length ? (
              <div className="grid sm:grid-cols-2 gap-3 max-w-[640px]">
                {descargas.map((d) => (
                  <a key={d.href} href={d.href} className="rounded-[12px] bg-[#1C2431] hover:bg-[#243045] border border-[#2B3648] p-4 flex flex-col gap-1">
                    <span className="text-[15px] font-bold text-white">{d.etiqueta}</span>
                    {d.nota && <span className="text-[12.5px] text-[#8A97AB]">{d.nota}</span>}
                  </a>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-[#8A97AB]">Esta pieza no tiene archivos para descargar.</p>
            )}
            <p className="m-0 max-w-[640px] text-[13px] leading-relaxed text-[#8A97AB]">
              STL para impresión 3D y para CAM (Fusion 360, Aspire, ArtCAM). OBJ para programas de diseño y render. Si la malla
              no cierra, repárala antes de imprimir (Bambu Studio, PrusaSlicer y Meshmixer lo hacen con un clic).
            </p>
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-[#1F2937] bg-[#0F151E] font-mono text-[12.5px] text-[#C9D2E0] flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-semibold text-white">«{titulo}»</span>
          {datos ? (
            <>
              <span>
                {escalaReal
                  ? `${fmt(datos.x, unidad)} × ${fmt(datos.y, unidad)} × ${fmt(datos.z, unidad)}`
                  : "Proporciones aproximadas (sin escala real)"}
              </span>
              <span>· {Math.round(datos.triangulos).toLocaleString("es-MX")} triángulos</span>
            </>
          ) : (
            <span>{cargando ? "cargando…" : "sin datos"}</span>
          )}
          {barra}
        </div>
      </div>
    </div>
  )
}
