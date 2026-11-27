"use client"

// Selector de modo de las herramientas que juntan varias (Patrones de corte,
// Letreros y placas): tarjetas con dibujo arriba del panel. Al elegir, la
// dirección cambia a la del modo (sin recargar) para que la liga compartida
// abra lo mismo.
import { useParams } from "next/navigation"

export type Modo<T extends string> = { id: T; slug: string; nombre: string; nota: string; icono: React.ReactNode }

export function SelectorModos<T extends string>({
  titulo,
  modos,
  modo,
  cambiar,
}: {
  titulo: string
  modos: Modo<T>[]
  modo: T
  cambiar: (m: T) => void
}) {
  const { locale } = useParams<{ locale: string }>()
  const elegir = (m: Modo<T>) => {
    cambiar(m.id)
    if (typeof window !== "undefined" && locale) window.history.replaceState(null, "", `/${locale}/disenar/${m.slug}`)
  }
  return (
    <section className="flex flex-col gap-2 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
      <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">{titulo}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(modos.length, 3)}, minmax(0, 1fr))` }}>
        {modos.map((m) => (
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
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">{modos.find((m) => m.id === modo)?.nota}</span>
    </section>
  )
}
