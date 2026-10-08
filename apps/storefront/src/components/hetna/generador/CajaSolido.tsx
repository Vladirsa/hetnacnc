"use client"

import { useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

import type { Pieza } from "@/lib/generador/caja"
import { chaflanMaximo } from "@/lib/generador/cajaReplicad"

type Props = {
  piezas: Pieza[]
  espesor: number
  exterior: { ancho: number; fondo: number; alto: number }
  nombreArchivo: string
}

type Estado = "inactivo" | "cargando-motor" | "calculando" | "listo" | "error"

export default function CajaSolido({ piezas, espesor, exterior, nombreArchivo }: Props) {
  const [estado, setEstado] = useState<Estado>("inactivo")
  const [chaflan, setChaflan] = useState("0")
  const [error, setError] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const limpiarRef = useRef<() => void>(() => {})
  const maximoChaflan = chaflanMaximo(piezas)

  const generar = async () => {
    setError("")
    try {
      setEstado("cargando-motor")
      const { cargarOC, construirSolidos, exportarSTEP } = await import("@/lib/generador/cajaReplicad")
      await cargarOC()

      setEstado("calculando")
      const r = parseFloat(chaflan.replace(",", ".")) || 0
      const solidos = await construirSolidos(piezas, espesor, exterior, r)

      // render
      const el = ref.current
      if (el) {
        limpiarRef.current()
        const { syncFaces } = await import("replicad-threejs-helper")

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0xf7f3ee)
        const camera = new THREE.PerspectiveCamera(45, Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight), 1, 10000)
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(el.clientWidth || 300, el.clientHeight || 300)
        el.innerHTML = ""
        el.appendChild(renderer.domElement)

        const material = new THREE.MeshStandardMaterial({ color: 0xd8a86b, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.05 })
        const grupo = new THREE.Group()
        for (const s of solidos) {
          const geo = new THREE.BufferGeometry()
          syncFaces(geo, s.shape.mesh())
          grupo.add(new THREE.Mesh(geo, material))
        }
        scene.add(grupo)

        const caja = new THREE.Box3().setFromObject(grupo)
        const centro = caja.getCenter(new THREE.Vector3())
        grupo.position.sub(centro)
        const tam = caja.getSize(new THREE.Vector3()).length() || 1
        camera.position.set(tam * 0.85, tam * 0.65, tam * 0.95)
        camera.lookAt(0, 0, 0)

        scene.add(new THREE.AmbientLight(0xffffff, 0.65))
        const luz = new THREE.DirectionalLight(0xffffff, 0.9)
        luz.position.set(1, 2, 1)
        scene.add(luz)

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

        const ro = new ResizeObserver(() => {
          const w = el.clientWidth || 300
          const h = el.clientHeight || 300
          renderer.setSize(w, h)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        })
        ro.observe(el)

        limpiarRef.current = () => {
          activo = false
          ro.disconnect()
          controls.dispose()
          renderer.dispose()
        }
      }

      // descargar STEP
      const blob = await exportarSTEP(solidos)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${nombreArchivo}.step`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setEstado("listo")
    } catch (e) {
      console.error(e)
      const mensaje = e instanceof Error ? e.message : ""
      setError(mensaje || "No se pudo generar el sólido con estos parámetros. Prueba con un chaflán más pequeño, o avísanos por WhatsApp.")
      setEstado("error")
    }
  }

  return (
    <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="m-0 text-[15px] font-semibold text-[#1B1B18]">Sólido real (STEP) para editar en tu CAD</h3>
          <p className="m-0 mt-1 text-[13px] text-[#6B6A63] max-w-[480px]">
            Genera un modelo sólido de verdad (no solo el plano de corte) y descarga un archivo STEP que puedes abrir y
            editar en Fusion360, SolidWorks, etc. La primera vez descarga un motor 3D (~20 MB).
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-[#1B1B18]">Chaflán de borde (mm)</span>
          <input
            type="text"
            inputMode="decimal"
            value={chaflan}
            onChange={(e) => setChaflan(e.target.value)}
            className="w-28 px-3 py-2 text-[15px] bg-white border border-[#E7E4DC] rounded-[10px] outline-none focus:border-[#C2560A]"
          />
        </label>
        <button
          type="button"
          onClick={generar}
          disabled={estado === "cargando-motor" || estado === "calculando"}
          className="bg-[#142033] hover:bg-[#0F1826] disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-[10px] text-[14px]"
        >
          {estado === "cargando-motor" && "Cargando motor 3D…"}
          {estado === "calculando" && "Calculando sólido…"}
          {(estado === "inactivo" || estado === "listo" || estado === "error") && "Generar y descargar STEP"}
        </button>
      </div>
      <p className="m-0 text-[12.5px] text-[#6B6A63]">
        Máximo recomendado para esta pieza: {maximoChaflan.toFixed(2)} mm.
        {parseFloat(chaflan.replace(",", ".")) > 0 && " Con chaflán activo, generar el sólido puede tardar 10-30 segundos (más dedos = más tiempo)."}
      </p>

      {error && <p className="m-0 text-[13px] text-[#8A1C1C]">{error}</p>}

      <div ref={ref} className="w-full h-[380px] rounded-[12px] overflow-hidden bg-[#FAF9F6] empty:flex empty:items-center empty:justify-center" />
    </div>
  )
}
