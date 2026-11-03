"use client"

// Barra de arriba de los estudios de pantalla completa: cambia entre 3D y 2D
// y entre las herramientas del estudio, sin el encabezado ni el pie del sitio.
import { useEffect } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ESTUDIOS, estudioDe, type Estudio } from "@/lib/hetna/disenar"

export function BarraEstudio() {
  const params = useParams()
  const actual = String(params?.herramienta || "")
  const estudio: Estudio = estudioDe(actual)
  // En el celular las pestañas se desplazan de lado: deja a la vista la activa.
  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('[data-pestanas] [aria-current="page"]')
      .forEach((a) => a.scrollIntoView({ block: "nearest", inline: "center" }))
  }, [actual])

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0C10]/95 text-white backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 lg:px-4">
        <LocalizedClientLink href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold tracking-wide" aria-label="Ir a HETNA CNC">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F07A1A] shadow-[0_0_12px_#F07A1A]" />
          HETNA
        </LocalizedClientLink>

        <nav aria-label="Estudio" className="flex shrink-0 rounded-[10px] bg-white/[0.06] p-1">
          {(["3d", "2d"] as const).map((e) => (
            <LocalizedClientLink
              key={e}
              href={`/disenar/${ESTUDIOS[e].herramientas[0].slug}`}
              aria-current={estudio === e ? "page" : undefined}
              className={`rounded-[8px] px-2.5 py-1 text-[13px] font-bold transition sm:px-3 ${
                estudio === e ? "bg-[#F07A1A] text-white" : "text-white/65 hover:text-white"
              }`}
            >
              {ESTUDIOS[e].nombre}
            </LocalizedClientLink>
          ))}
        </nav>

        <nav aria-label="Herramientas" className="hidden min-w-0 flex-1 lg:block">
          <Pestanas estudio={estudio} actual={actual} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 text-[13px] font-semibold">
          <LocalizedClientLink href="/disenar" className="hidden rounded-[8px] px-2.5 py-1.5 text-white/65 hover:bg-white/10 hover:text-white sm:block">
            Todas
          </LocalizedClientLink>
          <LocalizedClientLink href="/user" className="rounded-[8px] px-2.5 py-1.5 text-white/65 hover:bg-white/10 hover:text-white">
            Mi cuenta
          </LocalizedClientLink>
        </div>
      </div>
      <nav aria-label="Herramientas" className="border-t border-white/5 px-3 pb-2 pt-1 lg:hidden">
        <Pestanas estudio={estudio} actual={actual} />
      </nav>
    </header>
  )
}

function Pestanas({ estudio, actual }: { estudio: Estudio; actual: string }) {
  return (
    <ul data-pestanas className="m-0 flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ESTUDIOS[estudio].herramientas.map((h) => {
        const es = h.slug === actual
        return (
          <li key={h.slug} className="shrink-0">
            <LocalizedClientLink
              href={`/disenar/${h.slug}`}
              aria-current={es ? "page" : undefined}
              className={`block whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition ${
                es ? "bg-white text-[#0D1015]" : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              {h.corto}
            </LocalizedClientLink>
          </li>
        )
      })}
    </ul>
  )
}
