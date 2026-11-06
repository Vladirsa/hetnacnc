"use client"

// Vista previa de un plano o modelo (DXF, SVG, STL u OBJ) ya leído con
// lib/cotizador/archivo-cad. 2D: los contornos en SVG con zoom. 3D: la malla
// en three.js, girable con el mouse o el dedo. Sirve para que el cliente
// confirme que subió la pieza correcta y para que el taller la vea al cotizar.
import { useEffect, useRef, useState } from "react"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"

const mm = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString("es-MX")

export function resumenGeo(g: GeoCad) {
  return g.tipo === "3d"
    ? `${mm(g.largo)} × ${mm(g.ancho)} × ${mm(g.alto)} mm${g.volumen_cm3 ? ` · ${mm(g.volumen_cm3)} cm³` : ""}`
    : `${mm(g.largo)} × ${mm(g.ancho)} mm · ${(g.corte_mm / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} m de corte` +
        (g.perforaciones ? ` · ${g.perforaciones} perforaciones` : "")
}

export function VisorCad({ geo, alto = 260, oscuro = false }: { geo: GeoCad; alto?: number; oscuro?: boolean }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border"
      style={{ height: alto, background: oscuro ? "#0B0F15" : "#FAF9F6", borderColor: oscuro ? "#2B3648" : "#E7E4DC" }}
    >
      {geo.tipo === "3d" && geo.malla ? <Vista3D malla={geo.malla} oscuro={oscuro} /> : <Vista2D trazos={geo.trazos} oscuro={oscuro} />}
      <span
        className="pointer-events-none absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: oscuro ? "rgba(17,23,34,.9)" : "rgba(255,255,255,.9)", color: oscuro ? "#C9D2E0" : "#142033" }}
      >
        📐 {resumenGeo(geo)}
      </span>
      <span className="pointer-events-none absolute bottom-2 right-2 text-[10.5px]" style={{ color: oscuro ? "#8A97AB" : "#6B675C" }}>
        {geo.tipo === "3d" ? "arrastra para girar · rueda para acercar" : "rueda para acercar · arrastra para mover"}
      </span>
    </div>
  )
}

// ── 2D ─────────────────────────────────────────────────────────────────
function Vista2D({ trazos, oscuro }: { trazos: GeoCad["trazos"]; oscuro: boolean }) {
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const arrastre = useRef<{ x: number; y: number } | null>(null)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of trazos) for (const [x, y] of t) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (!Number.isFinite(x0)) return null
  const mar = Math.max(x1 - x0, y1 - y0) * 0.06 + 1
  const W = x1 - x0 + 2 * mar
  const H = y1 - y0 + 2 * mar
  const f = (n: number) => String(Math.round(n * 100) / 100)
  return (
    <svg
      viewBox={`0 0 ${f(W)} ${f(H)}`}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      onWheel={(e) => {
        e.preventDefault()
        setVista((v) => ({ ...v, k: Math.max(0.5, Math.min(20, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) }))
      }}
      onPointerDown={(e) => {
        arrastre.current = { x: e.clientX, y: e.clientY }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!arrastre.current) return
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const esc = Math.max(W / r.width, H / r.height)
        setVista((v) => ({ ...v, x: v.x + ((e.clientX - arrastre.current!.x) * esc) / v.k, y: v.y + ((e.clientY - arrastre.current!.y) * esc) / v.k }))
        arrastre.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={() => (arrastre.current = null)}
      onDoubleClick={() => setVista({ x: 0, y: 0, k: 1 })}
      role="img"
      aria-label="Vista previa del plano"
    >
      <g transform={`translate(${f(W / 2)} ${f(H / 2)}) scale(${f(vista.k)}) translate(${f(-W / 2 + vista.x)} ${f(-H / 2 + vista.y)})`}>
        {trazos.map((t, i) => (
          <polyline
            key={i}
            points={t.map(([x, y]) => `${f(x - x0 + mar)},${f(H - mar - (y - y0))}`).join(" ")}
            fill="none"
            stroke={oscuro ? "#5FA8F5" : "#C2560A"}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  )
}

// ── 3D ─────────────────────────────────────────────────────────────────
function Vista3D({ malla, oscuro }: { malla: Float32Array; oscuro: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let vivo = true
    let limpiar = () => {}
    import("three").then((THREE) => {
      if (!vivo || !el) return
      const esc = new THREE.Scene()
      esc.background = new THREE.Color(oscuro ? 0x0b0f15 : 0xfaf9f6)
      const cam = new THREE.PerspectiveCamera(40, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 100000)
      const ren = new THREE.WebGLRenderer({ antialias: true })
      ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      ren.setSize(el.clientWidth, el.clientHeight)
      el.appendChild(ren.domElement)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(malla, 3))
      geo.computeVertexNormals()
      geo.computeBoundingBox()
      const caja = geo.boundingBox!
      const centro = new THREE.Vector3()
      caja.getCenter(centro)
      const tam = new THREE.Vector3()
      caja.getSize(tam)
      const radio = Math.max(tam.x, tam.y, tam.z, 1)
      const pieza = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9a066, metalness: 0.1, roughness: 0.7, side: THREE.DoubleSide }))
      pieza.position.sub(centro)
      const grupo = new THREE.Group()
      grupo.add(pieza)
      // El modelo viene con Z hacia arriba (CAD): se acuesta para la cámara
      grupo.rotation.x = -Math.PI / 2
      esc.add(grupo)
      esc.add(new THREE.AmbientLight(0xffffff, 0.7))
      const luz = new THREE.DirectionalLight(0xffffff, 1.1)
      luz.position.set(1, 2, 1.5)
      esc.add(luz)
      const rejilla = new THREE.GridHelper(radio * 3, 12, oscuro ? 0x2b3648 : 0xd8d4c8, oscuro ? 0x1f2937 : 0xe7e4dc)
      rejilla.position.y = -tam.z / 2
      esc.add(rejilla)
      let dist = radio * 2.2
      let giroY = 0.6
      let giroX = 0.5
      const poner = () => {
        cam.position.set(dist * Math.sin(giroY) * Math.cos(giroX), dist * Math.sin(giroX), dist * Math.cos(giroY) * Math.cos(giroX))
        cam.lookAt(0, 0, 0)
        ren.render(esc, cam)
      }
      poner()
      let arr: { x: number; y: number } | null = null
      const abajo = (e: PointerEvent) => {
        arr = { x: e.clientX, y: e.clientY }
        ren.domElement.setPointerCapture(e.pointerId)
      }
      const mueve = (e: PointerEvent) => {
        if (!arr) return
        giroY += (e.clientX - arr.x) * 0.01
        giroX = Math.max(-1.4, Math.min(1.4, giroX + (e.clientY - arr.y) * 0.01))
        arr = { x: e.clientX, y: e.clientY }
        poner()
      }
      const suelta = () => (arr = null)
      const rueda = (e: WheelEvent) => {
        e.preventDefault()
        dist = Math.max(radio * 0.4, Math.min(radio * 8, dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1)))
        poner()
      }
      const redim = () => {
        cam.aspect = el.clientWidth / Math.max(1, el.clientHeight)
        cam.updateProjectionMatrix()
        ren.setSize(el.clientWidth, el.clientHeight)
        poner()
      }
      ren.domElement.addEventListener("pointerdown", abajo)
      ren.domElement.addEventListener("pointermove", mueve)
      ren.domElement.addEventListener("pointerup", suelta)
      ren.domElement.addEventListener("wheel", rueda, { passive: false })
      ren.domElement.style.touchAction = "none"
      window.addEventListener("resize", redim)
      limpiar = () => {
        window.removeEventListener("resize", redim)
        ren.dispose()
        geo.dispose()
        el.removeChild(ren.domElement)
      }
    })
    return () => {
      vivo = false
      limpiar()
    }
  }, [malla, oscuro])
  return <div ref={ref} className="h-full w-full" />
}
