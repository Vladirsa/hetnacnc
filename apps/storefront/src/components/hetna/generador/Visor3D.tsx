"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Marco común de las vistas 3D (Caja3D y Malla3D): botón de pantalla completa
// y pie con la ayuda de uso. La vista de adentro se redibuja sola al cambiar
// de tamaño (ResizeObserver), así que aquí sólo se cambia el contenedor.
export function Visor3D({ children, alto = "h-[440px] lg:h-[600px]" }: { children: React.ReactNode; alto?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [completa, setCompleta] = useState(false)

  useEffect(() => {
    const onCambio = () => setCompleta(document.fullscreenElement === ref.current)
    document.addEventListener("fullscreenchange", onCambio)
    return () => document.removeEventListener("fullscreenchange", onCambio)
  }, [])

  const alternar = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }, [])

  return (
    <div ref={ref} className={`relative w-full bg-[#F7F3EE] ${completa ? "h-screen" : alto} [&>div:first-child]:h-full`}>
      {children}
      <button
        type="button"
        onClick={alternar}
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-[8px] bg-[#142033]/85 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#142033]"
        aria-label={completa ? "Salir de pantalla completa" : "Ver en pantalla completa"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {completa ? <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /> : <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />}
        </svg>
        {completa ? "Salir" : "Pantalla completa"}
      </button>
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-[6px] bg-white/80 px-2 py-1 text-[11.5px] text-[#4A4943]">Arrastra para girar · rueda para acercar</span>
    </div>
  )
}
