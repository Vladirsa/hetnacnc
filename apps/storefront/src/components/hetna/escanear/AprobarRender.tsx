"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { responderRender } from "@/lib/escanear/acciones"

// Aprobar el render o pedir un ajuste (con comentario). También sirve para
// dejar un comentario en cualquier momento.
export function AprobarRender({ id, puedeAprobar, aviso }: { id: string; puedeAprobar: boolean; aviso: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)

  async function mandar(accion: "aprobar" | "ajuste" | "comentar") {
    setError("")
    if (accion !== "aprobar" && !texto.trim()) return setError(accion === "ajuste" ? "Escribe qué hay que ajustar." : "Escribe tu comentario.")
    if (accion === "aprobar" && !window.confirm(`¿Apruebas el render?\n\n${aviso}`)) return
    setOcupado(true)
    const r = await responderRender(id, accion, texto.trim() || undefined)
    setOcupado(false)
    if (!r.ok) return setError(r.mensaje)
    setTexto("")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        aria-label="Comentario"
        className="min-h-[90px] w-full rounded-[10px] border border-[#D9D5CC] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#C2560A]"
        maxLength={2000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={puedeAprobar ? "Si algo hay que cambiar, escríbelo aquí (medida, forma, barrenos…)" : "Escribe un comentario para el equipo"}
      />
      <div className="flex flex-wrap gap-2">
        {puedeAprobar && (
          <>
            <button type="button" disabled={ocupado} onClick={() => mandar("aprobar")} className="rounded-[12px] bg-[#0F7A4A] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#0B5E39] disabled:opacity-60">
              <T>Aprobar render</T>
            </button>
            <button type="button" disabled={ocupado} onClick={() => mandar("ajuste")} className="rounded-[12px] border border-[#C2560A] bg-white px-5 py-3 text-[15px] font-bold text-[#B34D07] hover:bg-[#FFF4EC] disabled:opacity-60">
              <T>Pedir ajuste</T>
            </button>
          </>
        )}
        <button type="button" disabled={ocupado} onClick={() => mandar("comentar")} className="rounded-[12px] border border-[#D9D5CC] bg-white px-5 py-3 text-[15px] font-semibold text-[#1B1B18] disabled:opacity-60">
          <T>Solo comentar</T>
        </button>
      </div>
      {error && <p className="m-0 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[13.5px] text-[#9B1C1C]">{error}</p>}
    </div>
  )
}
