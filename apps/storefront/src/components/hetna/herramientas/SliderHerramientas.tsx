"use client"

// Carrusel de la portada de /herramientas-cnc: enseña la calculadora y el
// cotizador con capturas reales. Avanza solo cada 6 s (se pausa al pasar el
// mouse o al tocar) y se puede cambiar con los puntos o las flechas.
import { useEffect, useState } from "react"
import Image from "next/image"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

type Diapositiva = {
  etiqueta: string
  titulo: string
  texto: string
  boton: { texto: string; href: string }
  imagen: { src: string; ancho: number; alto: number; alt: string; telefono?: boolean }
  acento: string
}

const DIAPOSITIVAS: Diapositiva[] = [
  {
    etiqueta: "Calculadora CNC profesional · gratis",
    titulo: "RPM, avance y pasadas exactas para tu router",
    texto: "Elige tu máquina, el material y la fresa. Te dice si tu spindle aguanta, cuánto se flexiona la fresa y cómo no quemar el MDF.",
    boton: { texto: "Abrir la calculadora", href: "/calculadora-cnc" },
    imagen: { src: "/img/herramientas/calculadora-router.jpg", ancho: 1920, alto: 1200, alt: "Calculadora CNC de HETNA con RPM, avance y profundidad por pasada para router" },
    acento: "#F07A1A",
  },
  {
    etiqueta: "Láser CO₂, fibra, plasma e impresión 3D",
    titulo: "Velocidad y potencia para tu láser, del K40 al de 300 W",
    texto: "Velocidad de corte, potencia, foco, kerf y el espesor máximo que alcanza tu tubo. También fibra, UV, plasma e impresión 3D.",
    boton: { texto: "Calcular mi láser", href: "/calculadora-cnc" },
    imagen: { src: "/img/herramientas/calculadora-laser.jpg", ancho: 1920, alto: 1200, alt: "Calculadora de láser CO₂ de HETNA con velocidad de corte, potencia y kerf" },
    acento: "#0EA5E9",
  },
  {
    etiqueta: "App HETNA Cotizador para talleres",
    titulo: "Cotiza en segundos y manda el precio por WhatsApp",
    texto: "Sube el DXF, la app mide el corte, calcula material, tiempo y tu utilidad, y te da tres precios. El cliente recibe el mensaje y el PDF.",
    boton: { texto: "Conocer el cotizador", href: "/servicios/cotizador-cnc" },
    imagen: { src: "/img/herramientas/cotizador-precio.jpg", ancho: 780, alto: 1560, alt: "App HETNA Cotizador mostrando precios económico, estándar y express", telefono: true },
    acento: "#19B374",
  },
]

export function SliderHerramientas() {
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(false)
  const n = DIAPOSITIVAS.length

  useEffect(() => {
    if (pausa) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6000)
    return () => clearTimeout(t)
  }, [i, pausa, n])

  const d = DIAPOSITIVAS[i]

  return (
    <div
      className="relative"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onTouchStart={() => setPausa(true)}
      aria-roledescription="carrusel"
    >
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div key={`t${i}`} className="animate-[aparecer_.5s_ease]">
          <span className="inline-block rounded-full px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide" style={{ background: `${d.acento}22`, color: d.acento }}>
            {d.etiqueta}
          </span>
          <h2 className="m-0 mt-4 text-[30px] font-extrabold leading-[1.08] text-white lg:text-[44px]">{d.titulo}</h2>
          <p className="m-0 mt-4 max-w-[560px] text-[16px] leading-relaxed text-white/70">{d.texto}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LocalizedClientLink
              href={d.boton.href}
              className="rounded-[12px] px-6 py-3.5 text-[15.5px] font-extrabold text-white shadow-lg hover:brightness-110"
              style={{ background: d.acento }}
            >
              {d.boton.texto} →
            </LocalizedClientLink>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => setI((x) => (x - 1 + n) % n)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-[18px] text-white/80 hover:border-white/40"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => setI((x) => (x + 1) % n)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-[18px] text-white/80 hover:border-white/40"
              >
                ›
              </button>
            </div>
          </div>
          <div className="mt-6 flex gap-2" role="tablist" aria-label="Diapositivas">
            {DIAPOSITIVAS.map((x, k) => (
              <button
                key={x.titulo}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={x.etiqueta}
                onClick={() => setI(k)}
                className="h-1.5 rounded-full transition-all"
                style={{ width: k === i ? 36 : 14, background: k === i ? d.acento : "rgba(255,255,255,0.25)" }}
              />
            ))}
          </div>
        </div>

        <div key={`i${i}`} className="relative flex min-h-[300px] items-center justify-center animate-[aparecer_.6s_ease] lg:min-h-[460px]">
          <div className="pointer-events-none absolute inset-6 rounded-full opacity-50 blur-3xl" style={{ background: d.acento }} aria-hidden="true" />
          {d.imagen.telefono ? (
            <div className="relative w-[240px] rounded-[38px] border-[10px] border-[#1C2230] bg-[#1C2230] shadow-2xl lg:w-[270px]">
              <Image src={d.imagen.src} alt={d.imagen.alt} width={d.imagen.ancho} height={d.imagen.alto} className="h-auto w-full rounded-[28px]" priority={i === 0} sizes="270px" />
            </div>
          ) : (
            <div className="relative w-full overflow-hidden rounded-[14px] border border-white/10 bg-[#1C2230] shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-3 truncate rounded-md bg-white/5 px-3 py-0.5 text-[11px] text-white/50">hetnacnc.com/calculadora-cnc</span>
              </div>
              <Image src={d.imagen.src} alt={d.imagen.alt} width={d.imagen.ancho} height={d.imagen.alto} className="h-auto w-full" priority={i === 0} sizes="(min-width: 1024px) 640px, 100vw" />
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes aparecer{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
