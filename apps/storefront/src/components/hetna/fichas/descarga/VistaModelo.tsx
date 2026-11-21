"use client"

// Visor 3D del modelo de muestra (no el archivo que se vende). Se carga sólo
// cuando el cliente abre la vista, para no hacer más pesada la ficha.
import { useEffect, useRef, useState } from "react"

import { VisorCad } from "@/components/hetna/visor/VisorCad"
import { type GeoCad, leerDxf, leerObj, leerStl, leerSvg } from "@/lib/cotizador/archivo-cad"
import type { FormatoVista } from "@/lib/hetna/ficha-tecnica"

export default function VistaModelo({ url, formato }: { url: string; formato: FormatoVista }) {
  const caja = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState(320)
  const [geo, setGeo] = useState<GeoCad | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (caja.current) setAlto(caja.current.clientHeight || 320)
  }, [])

  useEffect(() => {
    let vivo = true
    fetch(`/api/vista-previa?u=${encodeURIComponent(url)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        if (formato === "stl") return leerStl(await r.arrayBuffer())
        const t = await r.text()
        return formato === "obj" ? leerObj(t) : formato === "dxf" ? leerDxf(t) : leerSvg(t)
      })
      .then((g) => vivo && setGeo(g))
      .catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [url, formato])

  return (
    <div ref={caja} className="absolute inset-0">
      {geo ? (
        <VisorCad geo={geo} alto={alto} />
      ) : (
        <div className="flex h-full items-center justify-center text-[14px] text-[#5B6370]">
          {error ? "No se pudo cargar la vista 3D." : "Cargando vista 3D…"}
        </div>
      )}
    </div>
  )
}
