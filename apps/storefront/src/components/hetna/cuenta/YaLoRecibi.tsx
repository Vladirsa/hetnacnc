"use client"

// Botón "Ya lo recibí" del pedido: el comprador avisa que le llegó y el taller
// recibe su pago unos días después (lib/cuenta/recibido.ts).
import { useState, useTransition } from "react"

import { confirmarRecibido } from "@/lib/cuenta/recibido"

export function YaLoRecibi({ orderId, taller }: { orderId: string; taller: string }) {
  const [hecho, setHecho] = useState("")
  const [error, setError] = useState("")
  const [pendiente, iniciar] = useTransition()

  if (hecho) return <p className="m-0 rounded-[10px] bg-[#E7F5EC] px-3 py-2 text-[14px] text-[#1E7B3A]">{hecho}</p>

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3">
      <p className="m-0 text-[14px] text-[#142033]">
        ¿Ya te llegó tu pedido de <strong>{taller}</strong>?
      </p>
      <div className="flex items-center gap-2">
        {error && <span className="text-[13px] text-[#B3261E]">{error}</span>}
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              setError("")
              const r = await confirmarRecibido(orderId)
              if (r.ok) setHecho(r.mensaje)
              else setError(r.mensaje)
            })
          }
          className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Confirmando…" : "Ya lo recibí"}
        </button>
      </div>
    </div>
  )
}
