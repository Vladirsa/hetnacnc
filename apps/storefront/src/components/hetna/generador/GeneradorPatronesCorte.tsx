"use client"

// Patrones de corte (2D Studio): celosías, patrones radiales y bisagra viva
// en una sola herramienta. Las tres son "un patrón que se repite o se escala
// dentro de un área". Cada modo es la herramienta de antes tal cual (mismo
// motor y mismos archivos); aquí sólo se elige el modo. Las direcciones viejas
// siguen vivas y abren su modo; al cambiar de modo la dirección cambia para
// que la liga que se comparte abra lo mismo.
import { useState } from "react"
import { useParams } from "next/navigation"

import { GeneradorBisagra } from "./GeneradorBisagra"
import { GeneradorCelosias } from "./GeneradorCelosias"
import { GeneradorPatron } from "./GeneradorPatron"

export type ModoPatron = "celosia" | "radial" | "bisagra"

const MODOS: { id: ModoPatron; slug: string; nombre: string; nota: string; icono: React.ReactNode }[] = [
  {
    id: "celosia",
    slug: "celosias",
    nombre: "Celosía",
    nota: "Panel con marco y patrón calado",
    icono: (
      <>
        <rect x="6" y="6" width="28" height="28" rx="2" />
        <path d="M14 10l3 5-3 5-3-5zM26 10l3 5-3 5-3-5zM20 20l3 5-3 5-3-5z" />
      </>
    ),
  },
  {
    id: "radial",
    slug: "patrones-radiales",
    nombre: "Mandala",
    nota: "Capas escaladas y giradas",
    icono: (
      <>
        <path d="M20 5l13 9-5 16H12L7 14z" />
        <path d="M20 12l7 5-3 8h-8l-3-8z" />
      </>
    ),
  },
  {
    id: "bisagra",
    slug: "bisagra-viva",
    nombre: "Bisagra viva",
    nota: "Cortes para que el MDF doble",
    icono: (
      <>
        <rect x="5" y="10" width="30" height="20" rx="2" />
        <path d="M16 13v6M16 22v5M19 10v7M19 20v7M22 13v6M22 22v5M25 10v7M25 20v7" />
      </>
    ),
  },
]

export const SLUGS_PATRONES = MODOS.map((m) => m.slug)
export const modoDeSlug = (slug: string): ModoPatron => MODOS.find((m) => m.slug === slug)?.id || "celosia"

export function GeneradorPatronesCorte({ modoInicial = "celosia" }: { modoInicial?: ModoPatron }) {
  const { locale } = useParams<{ locale: string }>()
  const [modo, setModo] = useState<ModoPatron>(modoInicial)

  const elegir = (m: (typeof MODOS)[number]) => {
    setModo(m.id)
    // la dirección sigue al modo (sin recargar): compartir la liga abre lo mismo
    if (typeof window !== "undefined" && locale) window.history.replaceState(null, "", `/${locale}/disenar/${m.slug}`)
  }

  const cabecera = (
    <section className="flex flex-col gap-2 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
      <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Patrones de corte</span>
      <div className="grid grid-cols-3 gap-1.5">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={modo === m.id}
            onClick={() => elegir(m)}
            className={`flex flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[11.5px] font-semibold leading-tight transition ${
              modo === m.id ? "bg-[#C2560A]/20 text-white ring-2 ring-[#F28A3C]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
            }`}
          >
            <svg viewBox="0 0 40 40" className="h-7 w-7" fill="none" stroke={modo === m.id ? "#F28A3C" : "#8A97AB"} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              {m.icono}
            </svg>
            {m.nombre}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">{MODOS.find((m) => m.id === modo)?.nota}</span>
    </section>
  )

  if (modo === "radial") return <GeneradorPatron cabecera={cabecera} />
  if (modo === "bisagra") return <GeneradorBisagra cabecera={cabecera} />
  return <GeneradorCelosias cabecera={cabecera} />
}
