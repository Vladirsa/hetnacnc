"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export type BotonSlide = {
  texto: string
  href: string
  // true = liga externa (WhatsApp); false = ruta interna de la tienda
  externo?: boolean
}

export type Slide = {
  etiqueta: string
  titulo: string
  texto: string
  // ruta publica de la foto o null si todavia no existe en el servidor
  foto: string | null
  alt: string
  botones: [BotonSlide, BotonSlide]
}

const INTERVALO_MS = 5000

const FONDO_SIN_FOTO = {
  backgroundColor: "#0E1726",
  backgroundImage:
    "radial-gradient(ellipse at 78% 65%, rgba(194,86,10,0.38), transparent 55%), linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(135deg, #0B1424 0%, #142033 60%, #1E2C47 100%)",
  backgroundSize: "auto, 44px 44px, 44px 44px, auto",
}

const claseBoton = [
  "bg-[#C2560A] hover:bg-[#A84A08] text-white",
  "border-2 border-white/85 text-white hover:bg-white hover:text-[#142033]",
]

const Boton = ({
  boton,
  i,
  activo,
}: {
  boton: BotonSlide
  i: number
  activo: boolean
}) => {
  const clase = `${claseBoton[i]} px-4 py-2 lg:px-5 lg:py-2.5 rounded-[8px] text-[12px] lg:text-[13px] font-bold uppercase tracking-[0.06em] text-center`
  const tab = activo ? undefined : -1
  if (boton.externo) {
    return (
      <a
        href={boton.href}
        target="_blank"
        rel="noopener noreferrer"
        className={clase}
        tabIndex={tab}
      >
        {boton.texto}
      </a>
    )
  }
  return (
    <LocalizedClientLink href={boton.href} className={clase} tabIndex={tab}>
      {boton.texto}
    </LocalizedClientLink>
  )
}

export const HeroSlider = ({ slides }: { slides: Slide[] }) => {
  const [actual, setActual] = useState(0)
  // Las fotos 2..n se montan despues de la primera para no frenar la carga inicial
  const [resto, setResto] = useState(false)
  const [pausaUsuario, setPausaUsuario] = useState(false)
  const [pausaHover, setPausaHover] = useState(false)
  const reducido = useRef(false)

  const total = slides.length
  const ir = useCallback((n: number) => setActual(((n % total) + total) % total), [total])

  useEffect(() => {
    reducido.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const t = window.setTimeout(() => setResto(true), 1800)
    return () => window.clearTimeout(t)
  }, [])

  const pausado = pausaUsuario || pausaHover || !resto || total < 2

  useEffect(() => {
    if (pausado || reducido.current) return
    const t = window.setTimeout(() => ir(actual + 1), INTERVALO_MS)
    return () => window.clearTimeout(t)
  }, [actual, pausado, ir])

  return (
    <section
      className="relative w-full overflow-hidden text-white bg-[#0E1726]"
      aria-roledescription="carrusel"
      aria-label="Servicios de HETNA CNC"
      // Pausa solo con mouse o con teclado; en celular un toque no lo deja detenido
      onPointerEnter={(e) => e.pointerType === "mouse" && setPausaHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPausaHover(false)}
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches?.(":focus-visible")) setPausaHover(true)
      }}
      onBlurCapture={() => setPausaHover(false)}
    >
      {/* Fondos (foto o patron) apilados con desvanecido */}
      {slides.map((s, i) => (
        <div
          key={`fondo-${i}`}
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            i === actual ? "opacity-100" : "opacity-0"
          }`}
          style={s.foto ? undefined : FONDO_SIN_FOTO}
        >
          {s.foto && (i === 0 || resto) && (
            <Image
              src={s.foto}
              alt={s.alt}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : "lazy"}
              quality={70}
              sizes="100vw"
              className="object-cover"
            />
          )}
          {s.foto && (
            <>
              {/* Celular: capa pareja para que el texto se lea sobre toda la foto */}
              <div className="absolute inset-0 lg:hidden bg-[rgba(14,23,38,0.74)]" />
              {/* Escritorio: oscuro a la izquierda (texto) y la maquina visible a la derecha */}
              <div
                className="absolute inset-0 hidden lg:block"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(14,23,38,0.90) 0%, rgba(14,23,38,0.72) 42%, rgba(14,23,38,0.25) 100%)",
                }}
              />
            </>
          )}
        </div>
      ))}

      {/* Textos: todos en la misma celda para que la altura no brinque */}
      <div className="relative max-w-[1180px] mx-auto px-4 lg:px-16 pt-6 pb-11 lg:pt-8 lg:pb-12 grid">
        {slides.map((s, i) => {
          const activo = i === actual
          const Titulo = i === 0 ? "h1" : "h2"
          return (
            <div
              key={`texto-${i}`}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}: ${s.etiqueta}`}
              aria-hidden={!activo}
              className={`[grid-area:1/1] flex flex-col items-start text-left gap-2.5 max-w-[620px] transition-all duration-700 ease-out ${
                activo ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-2 invisible"
              }`}
            >
              <span className="uppercase tracking-[0.14em] text-[11px] font-semibold bg-[#C2560A] text-white px-3 py-1 rounded-full">
                {s.etiqueta}
              </span>
              <Titulo
                className="m-0 uppercase font-bold leading-[1.02] tracking-[0.005em] text-[24px] sm:text-[30px] lg:text-[38px]"
                style={{ fontFamily: "var(--font-condensed), var(--font-display), sans-serif" }}
              >
                {s.titulo}
              </Titulo>
              <p className="m-0 text-[14px] lg:text-[15.5px] leading-[1.5] text-[#D7DEEA] max-w-[560px]">
                {s.texto}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {s.botones.map((b, j) => (
                  <Boton key={b.texto} boton={b} i={j} activo={activo} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Controles: puntos + pausa */}
      {total > 1 && (
        <div className="absolute bottom-3 left-0 right-0">
          <div className="max-w-[1180px] mx-auto px-4 lg:px-16 flex items-center gap-1">
            {slides.map((s, i) => (
              <button
                key={`punto-${i}`}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ver ${s.etiqueta}`}
                aria-current={i === actual}
                className="h-6 flex items-center px-1"
              >
                <span
                  className={`block h-[4px] rounded-full transition-all duration-300 ${
                    i === actual ? "w-7 bg-[#E8833A]" : "w-3.5 bg-white/45 hover:bg-white/75"
                  }`}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPausaUsuario((p) => !p)}
              aria-label={pausaUsuario ? "Reanudar carrusel" : "Pausar carrusel"}
              className="ml-2 h-6 w-6 flex items-center justify-center rounded-full text-white/70 hover:text-white"
            >
              {pausaUsuario ? (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 1.5v9l7-4.5z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="2.5" y="1.5" width="2.5" height="9" fill="currentColor" />
                  <rect x="7" y="1.5" width="2.5" height="9" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
