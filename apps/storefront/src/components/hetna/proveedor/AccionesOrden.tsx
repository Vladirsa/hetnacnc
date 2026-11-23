"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { responderOrden } from "@/lib/proveedor/acciones"

// Confirmar una orden de compra (con la fecha en que se entrega) o avisar al
// taller que ya salió. Lo ve el taller en la app del Cotizador.
export function AccionesOrden({ id, puedeConfirmar, puedeMarcarEnviada, fechaPedida, fechaCompromiso, nota }: {
  id: string
  puedeConfirmar: boolean
  puedeMarcarEnviada: boolean
  fechaPedida: string | null
  fechaCompromiso: string | null
  nota: string | null
}) {
  const router = useRouter()
  const [fecha, setFecha] = useState(fechaCompromiso || fechaPedida || "")
  const [texto, setTexto] = useState(nota || "")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)

  async function mandar(accion: "confirmar" | "enviada") {
    setError("")
    if (accion === "confirmar" && !fecha) return setError("Pon la fecha en que vas a entregar.")
    if (accion === "enviada" && !window.confirm("¿Ya enviaste esta orden? El taller verá que va en camino.")) return
    setOcupado(true)
    const r = await responderOrden(id, accion === "confirmar" ? { accion, fecha_compromiso: fecha, nota: texto.trim() } : { accion, nota: texto.trim() })
    setOcupado(false)
    if (!r.ok) return setError(r.mensaje)
    router.refresh()
  }

  if (!puedeConfirmar && !puedeMarcarEnviada) return null
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-[#E7E4DC] bg-[#FAF9F6] p-4">
      {puedeConfirmar && (
        <label className="flex flex-col gap-1 text-[13.5px] font-semibold text-[#40403A]">
          Fecha en que entregas
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-[200px] rounded-[10px] border border-[#D9D5CC] bg-white px-3 py-2 text-[15px] font-normal outline-none focus:border-[#C2560A]" />
        </label>
      )}
      <textarea
        aria-label="Nota para el taller"
        maxLength={500}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nota para el taller (opcional): faltantes, sustitutos, número de guía…"
        className="min-h-[70px] w-full rounded-[10px] border border-[#D9D5CC] bg-white px-3 py-2 text-[15px] outline-none focus:border-[#C2560A]"
      />
      <div className="flex flex-wrap gap-2">
        {puedeConfirmar && (
          <button type="button" disabled={ocupado} onClick={() => mandar("confirmar")} className="rounded-[12px] bg-[#0F7A4A] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#0B5E39] disabled:opacity-60">
            {fechaCompromiso ? "Actualizar confirmación" : "Confirmar orden"}
          </button>
        )}
        {puedeMarcarEnviada && (
          <button type="button" disabled={ocupado} onClick={() => mandar("enviada")} className="rounded-[12px] border border-[#C2560A] bg-white px-5 py-3 text-[15px] font-bold text-[#B34D07] hover:bg-[#FFF4EC] disabled:opacity-60">
            Ya la envié
          </button>
        )}
      </div>
      {error && <p className="m-0 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[13.5px] text-[#9B1C1C]">{error}</p>}
    </div>
  )
}
