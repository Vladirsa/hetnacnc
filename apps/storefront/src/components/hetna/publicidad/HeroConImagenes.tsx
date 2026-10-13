"use client"

// Carrusel principal del inicio hecho con las imágenes que subes en el panel de publicidad.
import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { Pieza } from "@/lib/publicidad/tipos"
import { registrarVistas } from "@/lib/publicidad/vistas-cliente"

import { EnlacePub, EtiquetaPublicidad, ImagenPieza } from "./PiezasBase"

export default function HeroConImagenes({ piezas }: { piezas: Pieza[] }) {
  const [actual, setActual] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = piezas.length

  const ir = useCallback((i: number) => setActual((i + total) % total), [total])

  // Cuenta una vista cada vez que una diapositiva se muestra por primera vez en la sesión
  useEffect(() => {
    const p = piezas[actual]
    if (p) registrarVistas([p.id])
  }, [actual, piezas])

  useEffect(() => {
    if (pausado || total < 2) return
    const t = setTimeout(() => setActual((a) => (a + 1) % total), 6500)
    return () => clearTimeout(t)
  }, [actual, pausado, total])

  return (
    <section
      className="relative overflow-hidden bg-[#142033] text-white"
      aria-roledescription="carousel"
      aria-label="Portada de HETNA CNC"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      {/* Si la primera imagen no lleva título, dejamos un h1 invisible para buscadores */}
      {!piezas[0]?.titulo && <h1 className="sr-only">HETNA CNC: marketplace CNC de México</h1>}
      <div className="grid">
        {piezas.map((p, i) => {
          const visible = i === actual
          const Titulo = i === 0 ? "h1" : "h2"
          const conTexto = Boolean(p.titulo || p.subtitulo || p.boton)
          return (
            <div
              key={p.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!visible}
              inert={!visible}
              className={`col-start-1 row-start-1 transition-opacity duration-700 ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <EnlacePub id={p.id} publicidad={p.es_publicidad} className="relative block h-[300px] sm:h-[360px] lg:h-[460px]">
                {p.video_url && visible ? (
                  <video
                    src={p.video_url}
                    poster={p.imagen_url || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <ImagenPieza p={p} prioridad={i === 0} />
                )}
                {conTexto && <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />}
                <div className="relative mx-auto flex h-full max-w-[1280px] items-center px-4 pb-10 lg:px-16">
                  <div className="flex max-w-[560px] flex-col gap-3">
                    {p.titulo && (
                      <Titulo className="font-display m-0 text-[26px] font-bold leading-[1.1] tracking-[-0.01em] md:text-[38px] lg:text-[46px]">
                        {p.titulo}
                      </Titulo>
                    )}
                    {p.subtitulo && (
                      <p className="m-0 text-[14px] leading-[1.55] text-white/90 md:text-[16px]">{p.subtitulo}</p>
                    )}
                    {p.boton && (
                      <span className="mt-1 inline-block w-fit rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white">
                        {p.boton}
                      </span>
                    )}
                  </div>
                </div>
                {p.es_publicidad && <EtiquetaPublicidad />}
              </EnlacePub>
            </div>
          )
        })}
      </div>

      {total > 1 && (
        <>
          <div className="absolute bottom-3 left-4 flex items-center gap-2 lg:left-16">
            {piezas.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                aria-current={i === actual}
                className={`h-2 rounded-full transition-all ${
                  i === actual ? "w-6 bg-[#C2560A]" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
          <div className="absolute bottom-2 right-4 flex gap-2 lg:right-16">
            <button
              type="button"
              onClick={() => ir(actual - 1)}
              aria-label="Anterior"
              className="rounded-full bg-black/40 p-1.5 hover:bg-black/60"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => ir(actual + 1)}
              aria-label="Siguiente"
              className="rounded-full bg-black/40 p-1.5 hover:bg-black/60"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </section>
  )
}
