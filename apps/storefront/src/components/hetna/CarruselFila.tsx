"use client"

// Fila de productos que se desliza, con flechas en computadora (en celular se
// desliza con el dedo). Las tarjetas las dibuja el servidor; esto sólo mueve.
import { useRef } from "react"

const Flecha = ({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={lado === "izq" ? "Ver anteriores" : "Ver más"}
    className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E7E4DC] bg-white text-[#142033] shadow-md transition hover:border-[#C2560A] hover:text-[#C2560A] md:flex ${
      lado === "izq" ? "-left-4" : "-right-4"
    }`}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d={lado === "izq" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  </button>
)

export default function CarruselFila({ children }: { children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const mover = (dir: 1 | -1) => caja.current?.scrollBy({ left: dir * caja.current.clientWidth * 0.85, behavior: "smooth" })
  return (
    <div className="relative">
      <Flecha lado="izq" onClick={() => mover(-1)} />
      <div ref={caja} className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth [scrollbar-width:thin]">
        {children}
      </div>
      <Flecha lado="der" onClick={() => mover(1)} />
    </div>
  )
}
