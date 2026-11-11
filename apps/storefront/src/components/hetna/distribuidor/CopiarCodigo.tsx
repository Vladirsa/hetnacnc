"use client"

import { useState } from "react"

export function CopiarCodigo({ codigo }: { codigo: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(codigo); setOk(true); setTimeout(() => setOk(false), 2000) } catch { /* sin portapapeles */ }
      }}
      className="mt-1 w-full cursor-pointer border-0 bg-transparent text-[34px] font-black tracking-[.25em] text-white"
      title="Copiar"
    >
      {codigo}
      <span className="block text-[12px] font-normal tracking-normal text-white/60">{ok ? "¡Copiado!" : "Toca para copiar"}</span>
    </button>
  )
}
