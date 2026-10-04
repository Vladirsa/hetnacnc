"use client"

import { useState } from "react"

// Miniatura con botón de reproducir: el reproductor de YouTube solo se carga al hacer clic,
// así la ficha del producto no paga el peso del iframe si nadie lo reproduce.
export const VideoProducto = ({ id, titulo }: { id: string; titulo: string }) => {
  const [activo, setActivo] = useState(false)

  if (activo) {
    return (
      <iframe
        className="w-full aspect-video rounded-[10px] border-0"
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={titulo}
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setActivo(true)}
      aria-label={`Reproducir video: ${titulo}`}
      className="group relative w-full aspect-video rounded-[10px] overflow-hidden bg-[#142033]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover opacity-90 transition group-hover:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-16 h-16 rounded-full bg-[#F2A65E] text-[#142033] flex items-center justify-center shadow-lg transition group-hover:scale-105">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
