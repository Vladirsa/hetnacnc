"use client"

import { useState } from "react"

import { mandarArchivosAFabricar } from "@/lib/generador/aCotizador"

// Al aprobar: manda el modelo rediseñado a la solicitud de fabricación
// (/cotizar) con los datos ya llenos, igual que "Fabrícamelo" de los generadores.
export function CotizarEscanear({
  id,
  locale,
  modelo,
  pieza,
  material,
  salida,
  folio,
}: {
  id: string
  locale: string
  modelo: { id: string; nombre: string } | null
  pieza: string
  material: string | null
  salida: string
  folio: string
}) {
  const [estado, setEstado] = useState("")
  const ext = (modelo?.nombre.split(".").pop() || "").toLowerCase()
  const proceso = ["stl", "obj", "3mf"].includes(ext) ? "Impresión 3D" : "Maquinado"
  const datos = { pieza: pieza.slice(0, 120), material: material || undefined, proceso, nota: `Pieza reconstruida en Escanear (${folio}) · ${salida}. Cotizar prototipo y pieza final.` }

  async function cotizar() {
    if (!modelo) {
      window.location.href = `/${locale}/cotizar?${new URLSearchParams({ desde: "generador", pieza: datos.pieza, nota: datos.nota, ...(datos.material ? { material: datos.material } : {}) })}`
      return
    }
    setEstado("Preparando el archivo…")
    try {
      const r = await fetch(`/api/escanear/${id}/archivos/${modelo.id}`)
      if (!r.ok) throw new Error()
      const blob = await r.blob()
      if (!mandarArchivosAFabricar([{ nombre: modelo.nombre, contenido: blob }], locale, datos)) throw new Error()
    } catch {
      setEstado("No se pudo preparar el archivo. Descárgalo y súbelo en la cotización.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={cotizar} className="self-start rounded-[12px] bg-[#C2560A] px-6 py-3 text-[16px] font-bold text-white hover:bg-[#A84A08]">
        Cotizar fabricación
      </button>
      <p className="m-0 text-[12.5px] text-[#6B6A63]">Se abre la cotización con {modelo ? `el modelo «${modelo.nombre}» ya cargado` : "los datos de tu pieza"}: prototipo en {proceso.toLowerCase()} y pieza final.</p>
      {estado && <p className="m-0 text-[13px] text-[#0E2A5C]">{estado}</p>}
    </div>
  )
}
