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

type Unidad = "mm" | "in"
type Modo = "solido" | "alambre" | "ambos"
type Vista = "iso" | "frente" | "lado" | "arriba"

export type Descarga = { etiqueta: string; href: string; nota?: string }

const MATERIALES: { id: string; nombre: string; color: number; rugosidad: number; metal: number }[] = [
  { id: "naranja", nombre: "HETNA", color: 0xff6a1a, rugosidad: 0.55, metal: 0.05 },
  { id: "metal", nombre: "Metal", color: 0xb8bec6, rugosidad: 0.35, metal: 0.8 },
  { id: "madera", nombre: "Madera", color: 0xc69563, rugosidad: 0.8, metal: 0 },
  { id: "blanco", nombre: "Resina", color: 0xeeeae2, rugosidad: 0.45, metal: 0 },
]

const fmt = (mm: number, u: Unidad) => (u === "mm" ? `${mm.toFixed(1)} mm` : `${(mm / 25.4).toFixed(2)} in`)

export function Estudio3D({
  titulo,
  subtitulo,
  urlStl,
  tris,
  escalaReal = true,
  descargas = [],
  avisos = [],
}: {
  titulo: string
  subtitulo?: string
  urlStl?: string
  tris?: number[]
  // false: la malla no está en milímetros reales (vista previa por IA)
  escalaReal?: boolean
  descargas?: Descarga[]
  avisos?: string[]
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
    rejilla?: THREE.GridHelper
    cajaAyuda?: THREE.Box3Helper
    distancia?: number
  }>({})

  const [pestana, setPestana] = useState<"vista" | "exportar">("vista")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [material, setMaterial] = useState(MATERIALES[0].id)
  const [modo, setModo] = useState<Modo>("solido")
  const [rejilla, setRejilla] = useState(true)
  const [medidas, setMedidas] = useState(true)
  const [girar, setGirar] = useState(false)
  const [completa, setCompleta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<{ x: number; y: number; z: number; triangulos: number } | null>(null)

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
    el.appendChild(renderer.domElement)
    const controles = new OrbitControls(camara, renderer.domElement)
    controles.enableDamping = true

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223044, 0.9))
    const luz = new THREE.DirectionalLight(0xffffff, 1.1)
    luz.position.set(1, 2, 1.5)
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

    const montar = (geo: THREE.BufferGeometry) => {
      if (!vivo) return
      geo.computeVertexNormals()
      // Los STL vienen con Z arriba; three mira con Y arriba
      geo.rotateX(-Math.PI / 2)
      geo.computeBoundingBox()
      const caja = geo.boundingBox!
      const centro = caja.getCenter(new THREE.Vector3())
      geo.translate(-centro.x, -caja.min.y, -centro.z)
      geo.computeBoundingBox()
      const tam = geo.boundingBox!.getSize(new THREE.Vector3())

      const m = MATERIALES[0]
      const mat = new THREE.MeshStandardMaterial({ color: m.color, roughness: m.rugosidad, metalness: m.metal, side: THREE.DoubleSide })
      const malla = new THREE.Mesh(geo, mat)
      scene.add(malla)
      const alambre = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x9fb3d1, transparent: true, opacity: 0.35 })
      )
      alambre.visible = false
      scene.add(alambre)

      const lado = Math.max(tam.x, tam.y, tam.z) || 1
      const grid = new THREE.GridHelper(Math.ceil(lado * 3), 30, 0x3a4a63, 0x222c3b)
      scene.add(grid)
      const cajaAyuda = new THREE.Box3Helper(geo.boundingBox!.clone(), new THREE.Color(0xf2a65a))
      scene.add(cajaAyuda)

      const distancia = (lado / 2 / Math.tan((camara.fov * Math.PI) / 360)) * 1.6
      camara.near = lado / 1000
      camara.far = lado * 100
      camara.updateProjectionMatrix()
      controles.target.set(0, tam.y / 2, 0)

      Object.assign(estado.current, { renderer, camara, controles, material: mat, alambre, malla, rejilla: grid, cajaAyuda, distancia })
      ponerVista("iso")
      setDatos({ x: tam.x, y: tam.z, z: tam.y, triangulos: (geo.getAttribute("position")?.count || 0) / 3 })
      setCargando(false)
    }

    if (tris && tris.length >= 9) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3))
      montar(geo)
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
    const animar = () => {
      cuadro = requestAnimationFrame(animar)
      controles.update()
      renderer.render(scene, camara)
    }
    animar()

    return () => {
      vivo = false
      cancelAnimationFrame(cuadro)
      obs.disconnect()
      controles.dispose()
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
  }, [urlStl, tris])

  // ---- Ajustes que no rearman la escena --------------------------------
  useEffect(() => {
    const m = MATERIALES.find((x) => x.id === material) || MATERIALES[0]
    const mat = estado.current.material
    if (!mat) return
    mat.color.setHex(m.color)
    mat.roughness = m.rugosidad
    mat.metalness = m.metal
  }, [material, cargando])

  useEffect(() => {
    const { malla, alambre } = estado.current
    if (malla) malla.visible = modo !== "alambre"
    if (alambre) alambre.visible = modo !== "solido"
  }, [modo, cargando])

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
      v === "frente" ? new THREE.Vector3(0, 0, 1) : v === "lado" ? new THREE.Vector3(1, 0, 0) : v === "arriba" ? new THREE.Vector3(0, 1, 0.0001) : new THREE.Vector3(1, 0.8, 1.1)
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
    <div ref={marcoRef} className={`bg-[#0B1017] text-white rounded-[16px] overflow-hidden grid lg:grid-cols-[280px_1fr] ${completa ? "h-screen rounded-none" : ""}`}>
      {/* ---- Panel de ajustes ---- */}
      <aside className="bg-[#121923] border-b lg:border-b-0 lg:border-r border-[#1F2937] p-4 flex flex-col gap-5 lg:max-h-[720px] lg:overflow-y-auto">
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
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: `#${m.color.toString(16).padStart(6, "0")}` }} />
                {m.nombre}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Modo</h3>
          <div className="flex gap-1.5">
            <Chip activo={modo === "solido"} onClick={() => setModo("solido")}>Sólido</Chip>
            <Chip activo={modo === "alambre"} onClick={() => setModo("alambre")}>Malla</Chip>
            <Chip activo={modo === "ambos"} onClick={() => setModo("ambos")}>Ambos</Chip>
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

        <div className={`relative ${pestana === "vista" ? "" : "hidden"} ${completa ? "flex-1" : "h-[420px] lg:h-[560px]"}`}>
          <div ref={contRef} className="absolute inset-0" />
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[#8A97AB]">Cargando la pieza…</div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] text-[#F2B8A8]">{error}</div>
          )}
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] bg-black/40 px-2 py-1 text-[11.5px] text-[#C9D2E0]">
            Arrastrar = girar · clic derecho = mover · rueda = acercar
          </span>
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button type="button" onClick={() => ponerVista("iso")} className="rounded-[8px] bg-[#1C2431]/90 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#243045]">
              Centrar
            </button>
            <button type="button" onClick={guardarImagen} className="rounded-[8px] bg-[#1C2431]/90 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#243045]">
              Guardar imagen
            </button>
            <button type="button" onClick={pantallaCompleta} className="rounded-[8px] bg-[#C2560A] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[#A84A08]">
              {completa ? "Salir" : "Pantalla completa"}
            </button>
          </div>
        </div>

        {pestana === "exportar" && (
          <div className={`p-5 lg:p-8 flex flex-col gap-4 ${completa ? "flex-1" : "min-h-[420px] lg:min-h-[560px]"}`}>
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
        </div>
      </div>
    </div>
  )
}
