"use client"

// Panel → Estrategia → Fase 4: marcar una compensación por entrega tarde como
// aplicada (ya se dio el saldo a favor o el reembolso) o descartada.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from "react"

export function MarcarCompensacion({ id }: { id: string }) {
  const [ocupado, setOcupado] = useState(false)
  const marcar = async (estado: "aplicada" | "descartada") => {
    setOcupado(true)
    const r = await fetch("/api/app/panel/accion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ruta: "/admin/hetna-fase4", cuerpo: { solicitud_id: id, estado }, area: "pedidos" }),
    })
    setOcupado(false)
    if (!r.ok) return alert("No se pudo.")
    window.location.reload()
  }
  return (
    <div className="mt-1.5 flex gap-1.5">
      <button disabled={ocupado} onClick={() => { if (confirm("¿Ya le diste al cliente el saldo a favor o el reembolso?")) marcar("aplicada") }} className="rounded-lg bg-[#0F7A4A] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
        <T>✓ Ya la apliqué</T>
      </button>
      <button disabled={ocupado} onClick={() => marcar("descartada")} className="rounded-lg bg-[#F3F1EA] px-3 py-1.5 text-[12px] font-bold text-[#40403A] disabled:opacity-50">
        <T>Descartar</T>
      </button>
    </div>
  )
}
