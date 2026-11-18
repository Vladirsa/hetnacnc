"use client"

import { useState, useTransition } from "react"

import { pedirAvisoExistencia } from "@/lib/data/aviso-existencia"

// En un producto agotado: el cliente deja su correo y le avisamos cuando vuelva a haber.
export default function AvisoExistencia({ productId, variantId, correoInicial }: { productId: string; variantId?: string | null; correoInicial?: string | null }) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState(correoInicial || "")
  const [listo, setListo] = useState(false)
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  if (listo) {
    return (
      <p className="mt-3 rounded-[8px] bg-[#EEF7F0] px-3 py-2 text-[14px] font-semibold text-[#17633A]" data-testid="aviso-existencia-listo">
        ✓ Te avisamos a {email} en cuanto vuelva a haber.
      </p>
    )
  }
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 w-full rounded-[8px] border-2 border-[#142033] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#142033] hover:bg-[#F4F2EC]"
        data-testid="aviso-existencia-abrir"
      >
        🔔 Avísame cuando haya
      </button>
    )
  }
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        setError("")
        iniciar(async () => {
          const r = await pedirAvisoExistencia({ productId, variantId, email })
          if (r.ok) setListo(true)
          else setError(r.mensaje)
        })
      }}
    >
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Tu correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-0 flex-1 rounded-[8px] border border-[#E7E4DC] px-3 py-2.5 text-[15px]"
        aria-label="Correo para avisarte"
      />
      <button type="submit" disabled={pendiente} className="rounded-[8px] bg-[#142033] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60">
        {pendiente ? "Guardando…" : "Avísame"}
      </button>
      {error && <p className="w-full text-[13px] text-[#9B3225]">{error}</p>}
      <p className="w-full text-[12px] text-[#6B6A63]">Sólo te escribimos para avisarte de este producto.</p>
    </form>
  )
}
