"use client"

// Carrusel de las herramientas de un estudio (3D o 2D) en la portada de
// /disenar. Desliza con el dedo en el celular y con flechas en la computadora;
// es scroll nativo con "snap", sin librerías, para que cargue rápido.
import { useRef } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ServicioIcono } from "@/components/hetna/ServicioIcono"

export type TarjetaEstudio = { slug: string; nombre: string; texto: string; icono: string; gratis: boolean }

type Props = {
  id: string
  etiqueta: string
  titulo: string
  texto: string
  abrir: string // slug de la herramienta con la que abre el estudio
  herramientas: TarjetaEstudio[]
  acento: string
}

export function CarruselEstudio({ id, etiqueta, titulo, texto, abrir, herramientas, acento }: Props) {
  const fila = useRef<HTMLUListElement>(null)
  const mover = (dir: 1 | -1) => {
    const el = fila.current
    if (el) el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 lg:px-8">
        <div className="max-w-[720px]">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: acento }}>
            {etiqueta}
          </span>
          <h2 id={`${id}-titulo`} className="m-0 mt-1.5 text-[26px] font-extrabold leading-tight text-white lg:text-[34px]">
            {titulo}
          </h2>
          <p className="m-0 mt-2 text-[15px] leading-relaxed text-white/65">{texto}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Anterior"
            className="hidden h-10 w-10 place-items-center rounded-full border border-white/15 text-white/80 hover:border-white/40 hover:text-white sm:grid"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Siguiente"
            className="hidden h-10 w-10 place-items-center rounded-full border border-white/15 text-white/80 hover:border-white/40 hover:text-white sm:grid"
          >
            ›
          </button>
          <LocalizedClientLink
            href={`/disenar/${abrir}`}
            className="rounded-[10px] px-4 py-2.5 text-[14px] font-extrabold text-white hover:brightness-110"
            style={{ background: acento }}
          >
            Abrir el estudio →
          </LocalizedClientLink>
        </div>
      </div>

      <ul
        ref={fila}
        className="m-0 mt-6 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {herramientas.map((h) => (
          <li key={h.slug} className="w-[260px] shrink-0 snap-start sm:w-[290px]">
            <LocalizedClientLink
              href={`/disenar/${h.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#141922] transition hover:-translate-y-1 hover:border-white/25"
            >
              <span
                className="relative grid h-[150px] place-items-center overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 50% 45%, ${acento}40, transparent 65%), radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)`,
                  backgroundSize: "100% 100%, 18px 18px",
                }}
              >
                <span className="text-white transition duration-300 group-hover:scale-110" style={{ color: acento }}>
                  <ServicioIcono nombre={h.icono} size={64} />
                </span>
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    h.gratis ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {h.gratis ? "Gratis" : "1 gratis al mes"}
                </span>
              </span>
              <span className="flex flex-1 flex-col p-4">
                <span className="text-[16px] font-bold leading-tight text-white">{h.nombre}</span>
                <span className="mt-1.5 flex-1 text-[13.5px] leading-snug text-white/60">{h.texto}</span>
                <span className="mt-3 text-[13px] font-bold" style={{ color: acento }}>
                  Abrir →
                </span>
              </span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
