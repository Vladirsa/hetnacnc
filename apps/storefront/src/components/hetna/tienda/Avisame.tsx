"use client"

// "Avísame cuando haya": guarda el interés (categoría + correo o celular)
// dentro de HETNA para avisar al publicar el primer producto. Nada de
// mandar a la gente a WhatsApp: todo se queda en la plataforma.
import { useState } from "react"

import { trackAvisameCategoria } from "@/lib/analytics/events"
import { BTN, BTN2 } from "./piezas"

export function Avisame({ categoria, nombre }: { categoria: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false)
  const [contacto, setContacto] = useState("")
  const [trampa, setTrampa] = useState("")
  const [estado, setEstado] = useState<"" | "enviando" | "listo">("")
  const [error, setError] = useState("")

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEstado("enviando")
    try {
      const r = await fetch("/api/tienda-interes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "avisame", categoria, contacto, sitio_web: trampa }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.message || "No se pudo guardar.")
      trackAvisameCategoria(categoria)
      setEstado("listo")
    } catch (err) {
      setError((err as Error).message)
      setEstado("")
    }
  }

  if (estado === "listo")
    return (
      <p className="rounded-md bg-[#EAF5EE] px-3 py-3 text-[14px] font-medium text-[#1E6B3E]" role="status">
        Listo: te avisamos en cuanto haya {nombre.toLowerCase()}.
      </p>
    )

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`${BTN2} w-full sm:w-auto`}>
        Avísame cuando haya
      </button>
    )

  return (
    <form onSubmit={enviar} className="grid gap-2">
      <label className="text-[13px] font-medium text-[#1E2329]" htmlFor={`avisame-${categoria}`}>
        Tu correo o celular
      </label>
      <input
        id={`avisame-${categoria}`}
        value={contacto}
        onChange={(e) => setContacto(e.target.value)}
        required
        autoComplete="email"
        placeholder="tu@correo.com o 10 dígitos"
        className="min-h-[44px] w-full rounded-md border border-[#C5CCD3] bg-white px-3 text-[15px] outline-none focus:border-[#E85D04]"
      />
      {/* Trampa para robots: una persona no la ve */}
      <input value={trampa} onChange={(e) => setTrampa(e.target.value)} name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-[13px] text-[#B3261E]">{error}</p>}
      <button type="submit" disabled={estado === "enviando"} className={`${BTN} w-full`}>
        {estado === "enviando" ? "Guardando…" : "Avísame"}
      </button>
      <p className="text-[12px] text-[#5B6370]">Sólo lo usamos para avisarte de esta categoría.</p>
    </form>
  )
}
