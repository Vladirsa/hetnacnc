"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import type { GeoCad } from "@/lib/cotizador/archivo-cad"

import { VisorCad, resumenGeo } from "./VisorCad"

export function VisorDeLiga() {
  const params = useSearchParams()
  const u = params.get("u") || ""
  const nombre = params.get("n") || "archivo"
  const [geo, setGeo] = useState<GeoCad | null>(null)
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando")
  const [mensaje, setMensaje] = useState("")

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        if (!/^https:\/\//.test(u)) throw new Error("Falta la liga del archivo.")
        const ext = nombre.split(".").pop()?.toLowerCase() || ""
        if (!["dxf", "svg", "stl", "obj"].includes(ext)) throw new Error("El visor abre DXF, SVG, STL y OBJ. Este archivo descárgalo para verlo.")
        const r = await fetch(u)
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "La liga ya venció. Vuelve a pedirla desde tu panel." : `No se pudo descargar (${r.status}).`)
        const lib = await import("@/lib/cotizador/archivo-cad")
        let g: GeoCad
        if (ext === "dxf") g = lib.leerDxf(await r.text())
        else if (ext === "svg") g = lib.leerSvg(await r.text())
        else if (ext === "stl") g = lib.leerStl(await r.arrayBuffer())
        else g = lib.leerObj(await r.text())
        if (!vivo) return
        setGeo(g)
        setEstado("listo")
      } catch (e) {
        if (!vivo) return
        setMensaje((e as Error).message || "No se pudo abrir el archivo.")
        setEstado("error")
      }
    })()
    return () => {
      vivo = false
    }
  }, [u, nombre])

  return (
    <div className="flex flex-1 flex-col gap-3 p-4 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 text-[16px] font-bold">
          Visor <span className="text-[#F28A3C]">{nombre}</span>
        </h1>
        {geo && <span className="text-[12.5px] text-[#8A97AB]">{resumenGeo(geo)}</span>}
        {u && (
          <a href={u} download={nombre} className="text-[12.5px] font-semibold text-[#F28A3C] hover:underline">
            Descargar el archivo
          </a>
        )}
      </div>
      {estado === "cargando" && <p className="text-[14px] text-[#8A97AB]">Abriendo el archivo…</p>}
      {estado === "error" && <p className="rounded-[10px] border border-[#6a3a14] bg-[#2a1a0c] px-3 py-2 text-[13.5px] text-[#F6C79B]">{mensaje}</p>}
      {geo && (
        <div className="flex-1">
          <VisorCad geo={geo} alto={Math.max(420, typeof window !== "undefined" ? window.innerHeight - 140 : 520)} oscuro />
          {geo.avisos.length > 0 && <p className="mt-2 text-[12.5px] text-[#8A97AB]">{geo.avisos.join(" ")}</p>}
        </div>
      )}
    </div>
  )
}
