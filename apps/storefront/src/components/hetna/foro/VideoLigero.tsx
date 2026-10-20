"use client"

// Video incrustado que no carga nada pesado hasta que la persona le da play (la página abre rápido)
import { useState } from "react"

import { type Video, esVertical, reproductor } from "@/lib/foro/contenido"

const NOMBRE: Record<Video["tipo"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  vimeo: "Vimeo",
  facebook: "Facebook",
  instagram: "Instagram",
}

export function VideoLigero({ video }: { video: Video }) {
  const [activo, setActivo] = useState(false)
  const vertical = esVertical(video)
  const marco = vertical ? "w-full max-w-[340px] aspect-[9/16]" : "w-full aspect-video"

  if (activo)
    return (
      <div className={`${marco} rounded-[12px] overflow-hidden bg-black`}>
        <iframe
          src={reproductor(video)}
          title={`Video de ${NOMBRE[video.tipo]}`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )

  const miniatura = video.tipo === "youtube" ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : null
  return (
    <button
      type="button"
      onClick={() => setActivo(true)}
      className={`${marco} relative rounded-[12px] overflow-hidden bg-[#142033] group text-left`}
      aria-label={`Ver video de ${NOMBRE[video.tipo]}`}
    >
      {miniatura && (
        // eslint-disable-next-line @next/next/no-img-element
        <Image src={miniatura} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100" width={300} height={300} />
      )}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-t from-black/50 to-transparent">
        <span className="w-16 h-16 rounded-full bg-[#C2560A] group-hover:bg-[#A84A08] flex items-center justify-center shadow-lg">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span className="text-white text-[13px] font-semibold drop-shadow">Ver en {NOMBRE[video.tipo]}</span>
      </span>
    </button>
  )
}
