"use client"

// Pestañas Descripción / Especificaciones / Licencia. Todo el contenido va en
// el HTML (para Google y para quien no tiene JavaScript); sólo se oculta lo
// que no está elegido.
import { useState } from "react"

export function Pestanas({
  pestanas,
  etiqueta = "Detalles del diseño",
}: {
  pestanas: { clave: string; titulo: string; contenido: React.ReactNode }[]
  etiqueta?: string
}) {
  const [activa, setActiva] = useState(pestanas[0]?.clave)
  return (
    <section className="rounded-md border border-[#D4D9DF] bg-white" data-testid="pestanas-ficha">
      {/* En computadora la ficha va en la columna de la foto (más angosta): las
          pestañas bajan de renglón en vez de esconder la última */}
      <div role="tablist" aria-label={etiqueta} className="flex overflow-x-auto border-b border-[#D4D9DF] lg:flex-wrap lg:overflow-visible">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            id={`tab-${p.clave}`}
            aria-selected={activa === p.clave}
            aria-controls={`panel-${p.clave}`}
            onClick={() => setActiva(p.clave)}
            className={`min-h-[48px] shrink-0 border-b-[3px] px-5 lg:px-4 text-[15px] font-semibold ${
              activa === p.clave ? "border-[#E85D04] text-[#1E2329]" : "border-transparent text-[#5B6370] hover:text-[#1E2329]"
            }`}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      {pestanas.map((p) => (
        <div key={p.clave} role="tabpanel" id={`panel-${p.clave}`} aria-labelledby={`tab-${p.clave}`} hidden={activa !== p.clave} className="p-5">
          {p.contenido}
        </div>
      ))}
    </section>
  )
}
