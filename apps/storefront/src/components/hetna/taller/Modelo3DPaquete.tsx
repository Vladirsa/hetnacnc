"use client"

// «Ver en 3D» de un servicio: carga la muestra simplificada (STL) que subió el
// diseñador y la muestra en el visor, sin descargarla. Three.js sólo se carga
// al tocar el botón.
import dynamic from "next/dynamic"
import { useState } from "react"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"

const VisorCad = dynamic(() => import("@/components/hetna/visor/VisorCad").then((m) => m.VisorCad), { ssr: false })

export function Modelo3DPaquete({ url }: { url: string }) {
  const [geo, setGeo] = useState<GeoCad | null>(null)
  const [estado, setEstado] = useState<"cerrado" | "cargando" | "listo" | "error">("cerrado")

  async function abrir() {
    if (geo) return setEstado("listo")
    setEstado("cargando")
    try {
      const r = await fetch(`/api/vista-previa?u=${encodeURIComponent(url)}`)
      if (!r.ok) throw new Error()
      const { leerStl } = await import("@/lib/cotizador/archivo-cad")
      setGeo(leerStl(await r.arrayBuffer()))
      setEstado("listo")
    } catch {
      setEstado("error")
    }
  }

  if (estado === "listo" && geo) {
    return (
      <div className="mt-3">
        <VisorCad geo={geo} alto={220} />
        <button type="button" onClick={() => setEstado("cerrado")} className="mt-1 text-[12px] font-semibold text-[#6B675C] hover:underline">
          Cerrar vista 3D
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={abrir}
      disabled={estado === "cargando"}
      className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl border border-[#142033] px-3 py-1.5 text-[13px] font-semibold text-[#142033] hover:bg-[#F3F1EA] disabled:opacity-60"
    >
      {estado === "cargando" ? "Cargando modelo…" : estado === "error" ? "No se pudo abrir · reintentar" : "🧊 Ver ejemplo en 3D"}
    </button>
  )
}
