"use client"

// Campanita del encabezado: lleva a /mensajes y muestra cuántos mensajes
// de talleres no ha leído el cliente. Se actualiza sola cada 30 segundos
// (solo si la pestaña está a la vista, para no gastar el servidor).

import { useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { contarSinLeer } from "@/lib/chat/campanita"

export const CampanitaChat = ({
  isLoggedIn,
  compacto = false,
}: {
  isLoggedIn: boolean
  compacto?: boolean // true = versión de celular (solo el icono)
}) => {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!isLoggedIn) return
    let vivo = true
    const cargar = async () => {
      if (document.hidden) return
      const r = await contarSinLeer().catch(() => null)
      if (vivo && r && r.ok) setTotal(r.total)
    }
    cargar()
    const t = setInterval(cargar, 30000)
    document.addEventListener("visibilitychange", cargar)
    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener("visibilitychange", cargar)
    }
  }, [isLoggedIn])

  const etiqueta = total > 0 ? `Mensajes (${total} sin leer)` : "Mensajes"

  return (
    <LocalizedClientLink
      href={isLoggedIn ? "/mensajes" : "/login"}
      aria-label={etiqueta}
      title={etiqueta}
      className={
        compacto
          ? "relative p-1.5 text-[#142033]"
          : "relative flex items-center gap-1.5 p-2 -m-2 text-[#1B1B18] hover:text-[#B34D07]"
      }
    >
      <svg width={compacto ? 22 : 20} height={compacto ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {!compacto && <span className="hidden lg:inline text-[13px] font-medium">Mensajes</span>}
      {total > 0 && (
        <span className={`absolute ${compacto ? "top-0 right-0" : "top-0 left-4"} min-w-4 h-4 px-1 rounded-full bg-[#C2560A] text-white text-[10px] font-bold flex items-center justify-center`}>
          {total > 9 ? "9+" : total}
        </span>
      )}
    </LocalizedClientLink>
  )
}
