"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { responder } from "@/lib/foro/acciones"
import { MENSAJES } from "@/lib/foro/tipos"

import { IconoResponder } from "./IconosCNC"
import { PideCuenta } from "./Interaccion"
import { type FotoSubida, SubirFotos } from "./SubirFotos"

export function FormRespuesta({ temaId, padreId, onListo, compacto = false }: { temaId: number; padreId?: number; onListo?: () => void; compacto?: boolean }) {
  const router = useRouter()
  const [cuerpo, setCuerpo] = useState("")
  const [fotos, setFotos] = useState<FotoSubida[]>([])
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [pendiente, iniciar] = useTransition()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setAviso("")
    iniciar(async () => {
      const r = await responder({ temaId, padreId, cuerpo, fotos: fotos.map((f) => f.id) })
      if (!r.ok) return setError(r.error)
      setCuerpo("")
      setFotos([])
      if (r.estado === "revision") setAviso("Recibimos tu respuesta. Se publica en cuanto la revisemos.")
      else if (r.ocultos) setAviso("Publicada. Ocultamos los datos de contacto: los tratos se hacen dentro de HETNA para que estés protegido.")
      onListo?.()
      router.refresh()
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <textarea
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
        required
        maxLength={10000}
        rows={compacto ? 3 : 5}
        placeholder={padreId ? "Escribe tu respuesta…" : "Comparte lo que sabes: máquina, herramienta, parámetros o una liga de video. Para G-code, escríbelo entre ``` y ```."}
        className="w-full border border-[#E0DCD2] rounded-[10px] px-3.5 py-3 text-[15px] leading-relaxed bg-white focus:outline-none focus:border-[#C2560A] resize-y"
      />
      {!compacto && <SubirFotos fotos={fotos} onCambio={setFotos} max={4} />}
      {error && (["sin_sesion", "sin_perfil"].includes(error) ? <PideCuenta error={error} /> : <p className="m-0 text-[13.5px] text-[#A42A2A]">{MENSAJES[error] || error}</p>)}
      {aviso && <p className="m-0 text-[13.5px] text-[#16794F]">{aviso}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendiente || cuerpo.trim().length < 2} className="inline-flex items-center gap-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-2.5 rounded-[10px] text-[14.5px] disabled:opacity-50">
          <IconoResponder size={18} />
          {pendiente ? "Publicando…" : "Responder"}
        </button>
        {onListo && (
          <button type="button" onClick={onListo} className="text-[14px] text-[#6B6A63] hover:text-[#1B1B18]">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

// Botón "Responder" bajo cada respuesta que abre un formulario corto
export function ResponderA({ temaId, padreId }: { temaId: number; padreId: number }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E0DCD2] bg-white text-[13.5px] font-semibold text-[#44433D] hover:border-[#C2560A] hover:text-[#B34D07]">
        <IconoResponder size={18} />
        Responder
      </button>
    )
  return (
    <div className="w-full pt-2">
      <FormRespuesta temaId={temaId} padreId={padreId} compacto onListo={() => setAbierto(false)} />
    </div>
  )
}
