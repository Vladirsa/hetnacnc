"use client"

import { useState, useTransition } from "react"

import { ligaDescarga } from "@/lib/cuenta/descargas"

// Pide una liga nueva al momento y la abre: nunca se guarda una liga vieja.
export function BotonDescarga({ productId }: { productId: string }) {
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setError("")
            const r = await ligaDescarga(productId)
            if (r.ok) window.location.href = r.url
            else setError(r.mensaje)
          })
        }
        className="rounded-full bg-[#C2560A] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
      >
        {pendiente ? "Preparando…" : "Descargar"}
      </button>
      {error && <span className="text-[12.5px] text-[#B3261E]">{error}</span>}
    </div>
  )
}
