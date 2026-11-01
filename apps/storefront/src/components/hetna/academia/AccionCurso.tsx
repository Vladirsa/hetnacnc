"use client"

// Botón principal del curso: inscribirse gratis, comprarlo o "ya estás inscrito".
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { inscribirmeGratis } from "@/lib/data/courses"

const BTN = "inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-[10px] text-[15px] w-full sm:w-auto"

export function AccionCurso({
  slug,
  gratis,
  precio,
  productHandle,
  inscrito,
}: {
  slug: string
  gratis: boolean
  precio: string
  productHandle: string | null
  inscrito: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [aviso, setAviso] = useState<{ texto: string; sesion?: boolean } | null>(null)

  if (inscrito) {
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-[#1F7A4D]">✓ Ya estás inscrito</span>
        <a href="#temario" className={`${BTN} bg-[#142033] hover:bg-black text-white`}>
          Empezar a ver el curso
        </a>
      </div>
    )
  }

  if (!gratis) {
    return productHandle ? (
      <LocalizedClientLink href={`/products/${productHandle}`} className={`${BTN} bg-[#C2560A] hover:bg-[#A84A08] text-white`}>
        Comprar curso · {precio}
      </LocalizedClientLink>
    ) : null
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await inscribirmeGratis(slug)
            if (r.ok) {
              setAviso({ texto: r.mensaje })
              router.refresh()
            } else {
              setAviso({ texto: r.mensaje, sesion: r.sesion === false })
            }
          })
        }
        className={`${BTN} bg-[#1F7A4D] hover:bg-[#17603C] text-white disabled:opacity-60`}
      >
        {pendiente ? "Inscribiendo…" : "Inscribirme gratis"}
      </button>
      {aviso && (
        <p className="m-0 text-[13.5px] text-[#6B6A63]" role="status">
          {aviso.texto}{" "}
          {aviso.sesion && (
            <LocalizedClientLink href="/user" className="font-semibold text-[#B34D07] underline">
              Entrar o crear cuenta
            </LocalizedClientLink>
          )}
        </p>
      )}
    </div>
  )
}
