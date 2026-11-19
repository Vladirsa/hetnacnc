"use client"

// Mandar lo que hizo el cliente directo al CAM de HETNA, sin descargar y volver
// a subir: el DXF al CAM Studio 2D (corte láser o router: perfiles, cajas y
// barrenos) y el STL al Laboratorio CAM 3, 4 y 5 ejes (desbaste y acabado).
import { useParams } from "next/navigation"
import { useState } from "react"

import { mandarACam2D, mandarALaboratorio } from "@/lib/generador/aLaboratorio"

export function BotonesCam({ nombre, dxf, stl, compacto = false }: { nombre: string; dxf?: () => string | null | Promise<string | null>; stl?: () => ArrayBuffer | null | Promise<ArrayBuffer | null>; compacto?: boolean }) {
  const { locale } = useParams<{ locale: string }>()
  const [enviando, setEnviando] = useState<"" | "2d" | "3d">("")
  const [aviso, setAviso] = useState("")
  if (!dxf && !stl) return null
  const base = nombre.replace(/\.(dxf|stl|svg)$/i, "")
  const ir = async (tipo: "2d" | "3d") => {
    setAviso("")
    setEnviando(tipo)
    let ok = false
    try {
      if (tipo === "2d") {
        const t = await dxf?.()
        ok = !!t && (await mandarACam2D(`${base}.dxf`, t, locale))
      } else {
        const b = await stl?.()
        ok = !!b && (await mandarALaboratorio(`${base}.stl`, b, locale))
      }
    } catch {
      ok = false
    }
    if (!ok) {
      setEnviando("")
      setAviso("No se pudo mandar. Descarga el archivo y súbelo en el CAM.")
    }
  }
  const clase = "flex-1 rounded-[8px] px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {dxf && (
          <button type="button" disabled={!!enviando} onClick={() => ir("2d")} className={`${clase} bg-[#142A3D] text-[#BFE0FF] hover:bg-[#1A3650]`}>
            {enviando === "2d" ? "Abriendo…" : "Maquinar en CAM 2D"}
            {!compacto && <span className="block text-[11px] font-normal text-[#8FB4D6]">Láser o router: corte, cajas, barrenos</span>}
          </button>
        )}
        {stl && (
          <button type="button" disabled={!!enviando} onClick={() => ir("3d")} className={`${clase} bg-[#2A1C12] text-[#FFD2B0] hover:bg-[#3A2616]`}>
            {enviando === "3d" ? "Abriendo…" : "Laboratorio CAM 3-5 ejes"}
            {!compacto && <span className="block text-[11px] font-normal text-[#D6A989]">Router: desbaste y acabado en 3D</span>}
          </button>
        )}
      </div>
      {aviso && <span className="text-[11.5px] text-[#F6B8AE]">{aviso}</span>}
    </div>
  )
}
