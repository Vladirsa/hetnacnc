"use client"

// "Mándame este estimado por correo" (cotizador de /cotizar): quien ve su
// precio y todavía no pide propuestas puede guardarlo en su correo. Con su
// permiso entra al Reactivador de estimados (seguimiento a los 2 y 7 días) y
// cuenta como Lead para los anuncios.
import { useState } from "react"

import { nuevoEventoEstimado, trackEstimadoInstantaneo } from "@/lib/analytics/events"
import { mandarEstimadoCorreo } from "@/lib/cotizar/acciones"
import { permiteRastreo } from "@/lib/hetna/consentimiento"

export function MandarEstimado(p: { servicio: string; material: string; largoMm: number; anchoMm: number; cantidad: number; min: number; max: number; emailInicial?: string }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | "error">("")
  const [mensaje, setMensaje] = useState("")

  if (estado === "listo") return <p className="mt-3 rounded-xl bg-[#EEF7F0] px-4 py-2 text-sm text-[#17633A]">✓ Listo, te mandamos el estimado a tu correo.</p>
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-3 text-sm font-semibold text-[#142033] underline decoration-dotted hover:text-[#C2560A]">
        ✉️ Mándame este estimado por correo
      </button>
    )

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setEstado("enviando")
    const rastreo = permiteRastreo()
    const eventoId = nuevoEventoEstimado()
    const r = await mandarEstimadoCorreo({
      email: String(fd.get("email") || ""),
      acepta: fd.get("acepta") === "1",
      sitio_web: String(fd.get("sitio_web") || ""),
      servicio: p.servicio,
      material: p.material,
      largo_mm: p.largoMm,
      ancho_mm: p.anchoMm,
      cantidad: p.cantidad,
      estimado_min: p.min,
      estimado_max: p.max,
      rastreo,
      evento_id: eventoId,
    })
    if (!r.ok) {
      setEstado("error")
      setMensaje(r.mensaje)
      return
    }
    if (rastreo) trackEstimadoInstantaneo(p.servicio, eventoId)
    setEstado("listo")
  }

  return (
    <form onSubmit={enviar} className="mt-3 grid gap-2 rounded-xl border border-[#E7E4DC] bg-white p-3">
      <label className="flex flex-col gap-1 text-[13px] font-medium text-[#1B1B18]">
        Tu correo
        <input name="email" type="email" required defaultValue={p.emailInicial} autoComplete="email" className="rounded-lg border border-[#D9D5CA] px-3 py-2 text-[15px]" />
      </label>
      <input name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-[12.5px] text-[#40403A]">
        <input type="checkbox" name="acepta" value="1" required className="mt-0.5 accent-[#C2560A]" />
        <span>Mándame este estimado y un recordatorio en unos días para pedir propuestas. Puedo darme de baja cuando quiera.</span>
      </label>
      {estado === "error" && <p className="text-xs text-[#B3261E]">{mensaje}</p>}
      <button type="submit" disabled={estado === "enviando"} className="justify-self-start rounded-lg bg-[#142033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {estado === "enviando" ? "Enviando…" : "Mandar a mi correo"}
      </button>
    </form>
  )
}
