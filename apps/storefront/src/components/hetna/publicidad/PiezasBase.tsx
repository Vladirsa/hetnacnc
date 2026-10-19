// Piezas visuales compartidas por todos los espacios de publicidad.
import type { ReactNode } from "react"

import type { Pieza } from "@/lib/publicidad/tipos"

// Todo clic pasa por /api/pub/clic/<id> para poder contarlo. Los anuncios de terceros llevan rel="sponsored".
export function EnlacePub({
  id,
  publicidad,
  className,
  children,
}: {
  id: string
  publicidad: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <a href={`/api/pub/clic/${id}`} rel={publicidad ? "sponsored noopener" : "noopener"} className={className}>
      {children}
    </a>
  )
}

// Imagen del anuncio (con versión para celular si existe). Usa <img> normal: no requiere configurar dominios.
export function ImagenPieza({
  p,
  prioridad = false,
  className = "absolute inset-0 h-full w-full object-cover",
}: {
  p: Pieza
  prioridad?: boolean
  className?: string
}) {
  if (!p.imagen_url) return null
  return (
    <picture>
      {p.imagen_movil_url && <source media="(max-width: 767px)" srcSet={p.imagen_movil_url} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.imagen_url}
        alt={p.titulo || p.anunciante || "Banner HETNA CNC"}
        className={className}
        loading={prioridad ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={prioridad ? "high" : "auto"}
      />
    </picture>
  )
}

export const EtiquetaPublicidad = () => (
  <span className="absolute right-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
    Publicidad
  </span>
)

// Texto sobre la imagen (solo si el anuncio tiene título, subtítulo o botón).
export function TextoPieza({ p }: { p: Pieza }) {
  if (!p.titulo && !p.subtitulo && !p.boton) return null
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white md:p-5">
      {p.titulo && <strong className="text-[15px] leading-tight md:text-lg">{p.titulo}</strong>}
      {p.subtitulo && <span className="text-[12.5px] leading-snug text-white/85 md:text-[13.5px]">{p.subtitulo}</span>}
      {p.boton && (
        <span className="mt-1 inline-block w-fit rounded-lg bg-[#C2560A] px-3.5 py-1.5 text-[13px] font-bold text-white">
          {p.boton}
        </span>
      )}
    </div>
  )
}
