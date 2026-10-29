"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { vincularMiTaller } from "@/lib/foro/acciones"
import { MENSAJES } from "@/lib/foro/tipos"

// "Mi taller" en el perfil del foro. Si el correo de la cuenta es el de un
// taller registrado, se liga con un clic: sus publicaciones salen con la
// insignia de taller (verificado, si HETNA ya lo verificó) y la liga a su
// perfil del directorio. Si no hay taller, se le invita a registrarlo.
export function VincularTaller({
  ligado,
  encontrado,
}: {
  ligado: { handle: string; nombre: string; verificado: boolean } | null
  encontrado: { handle: string; nombre: string; verificado: boolean } | null
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState("")

  const caja = "bg-white border border-[#E7E4DC] rounded-[16px] p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between scroll-mt-24"

  if (ligado) {
    return (
      <div id="taller" className={caja}>
        <span>
          <span className="block font-bold text-[#1B1B18]">
            Tu perfil está ligado a {ligado.nombre} {ligado.verificado ? "· ✓ Taller verificado" : ""}
          </span>
          <span className="text-[14px] text-[#55544D]">Tus temas y respuestas llevan a la página de tu taller.</span>
        </span>
        <LocalizedClientLink href={`/talleres/${ligado.handle}`} className="shrink-0 text-[14px] font-semibold text-[#B34D07] hover:underline">
          Ver mi taller
        </LocalizedClientLink>
      </div>
    )
  }

  if (encontrado) {
    return (
      <div id="taller" className={`${caja} border-[#B9DCC4] bg-[#EEF6EE]`}>
        <span>
          <span className="block font-bold text-[#1B1B18]">Tu cuenta es de {encontrado.nombre}. ¿Lo ligamos a tu perfil?</span>
          <span className="text-[14px] text-[#55544D]">
            Saldrá la insignia {encontrado.verificado ? "“✓ Taller verificado”" : "“Taller HETNA”"} en todo lo que publiques, con liga a tu taller.
          </span>
          {error && <span className="block text-[13px] text-[#B3261E]">{error}</span>}
        </span>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              setError("")
              const r = await vincularMiTaller()
              if (!r.ok) setError(MENSAJES[r.error] || r.error)
              else router.refresh()
            })
          }
          className="shrink-0 rounded-[10px] bg-[#16794F] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {pendiente ? "Ligando…" : "Ligar mi taller"}
        </button>
      </div>
    )
  }

  return (
    <div id="taller" className={caja}>
      <span>
        <span className="block font-bold text-[#1B1B18]">¿Tienes un taller CNC?</span>
        <span className="text-[14px] text-[#55544D]">
          Regístralo en HETNA con el mismo correo de esta cuenta y vuelve aquí para ligarlo: tus respuestas llevarán clientes a tu taller.
        </span>
      </span>
      <LocalizedClientLink href="/talleres/unete" className="shrink-0 rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#A84A08]">
        Registrar mi taller
      </LocalizedClientLink>
    </div>
  )
}
